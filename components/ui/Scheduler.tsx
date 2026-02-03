import React, { useCallback, useEffect, useRef, useState } from "react";
import "dhtmlx-scheduler";
import "dhtmlx-scheduler/codebase/dhtmlxscheduler_material.css";
import "dhtmlx-scheduler/codebase/ext/dhtmlxscheduler_limit.js";
// import 'dhtmlx-scheduler/codebase/dhtmlxscheduler.css';
// import "dhtmlx-scheduler/codebase/dhtmlxscheduler";
// import "dhtmlx-scheduler/codebase/dhtmlxscheduler.css";
import { safeUser } from "@/types";
import { toast } from "react-hot-toast";
//import "@/app/ScheduleStyle.css";
//import "dhtmlx-scheduler/codebase/locale/locale_no.js";

interface Dates {
  id: string;
  start_date: Date;
  end_date: Date;
  text: string;
  css?: string;
}

interface SchedulerProps {
  timeFormatState: boolean;
  onDataUpdated?: (action: string, event: any, id: string) => void;
  dates: Dates[];
  onSubmit: (
    data: { start_date: Date; end_date: Date; text: string }
  ) => Promise<{ id?: string } | void> | { id?: string } | void;
  onUpdateReservation: (id: string, isUpdate: any) => void;
  onCancelReservation: (id: string) => void;
  setIsReservation: any;
  onDateSelect: (startDate: string, endDate: string, eventName: string) => void;
  currentUser?: safeUser | null;
  isLoading?: boolean;
  isCancelling?: boolean;
  setIsCancelling?: (value: boolean) => void;
  roomId?: string; // Add roomId prop for Global Guard
}

const scheduler =
  typeof window !== "undefined"
    ? (window as any).scheduler
    : console.log("Window undefined");

// GLOBAL DISPATCHER: The "Phone Switchboard"
// We attach listeners to dhtmlx *once*. They call methods on this object.
// The active component swaps these methods with its own.
const GLOBAL_DISPATCHER: any = {
  onEventAdded: null,
  onBeforeEventChanged: null,
  onLightboxButton: null,
  onBeforeViewChange: null,
  onBeforeDrag: null,
  event_class: null,
};

let GLOBAL_LISTENERS_ATTACHED = false;
let GLOBAL_ACTIVE_ROOM_ID: string | null | undefined = null;
let INSTANCE_COUNTER = 0;

const Scheduler = ({
  timeFormatState,
  onDataUpdated,
  setIsReservation,
  onSubmit,
  onUpdateReservation,
  currentUser,
  dates,
  onDateSelect,
  onCancelReservation,
  isLoading = false,
  isCancelling = false,
  setIsCancelling,
  roomId
}: SchedulerProps) => {
  const instanceId = useRef(++INSTANCE_COUNTER);
  const schedulerContainerRef = useRef(null);
  const [event, setEvent] = useState<Dates[]>([]);
  const [buttonStates, setButtonStates] = useState<{
    save: 'idle' | 'loading' | 'success' | 'error';
    cancel: 'idle' | 'loading' | 'success' | 'error';
  }>({
    save: 'idle',
    cancel: 'idle'
  });

  const markedTimespanRef = useRef<any>(null);
  const isCancellingRef = useRef<boolean>(Boolean(isCancelling));
  // Store event listener IDs for cleanup
  const attachedEventIdsRef = useRef<string[]>([]);
  // Keep track of last known event state to support reverting after failed updates/validation
  const lastEventStateRef = useRef<Record<string, { start: Date; end: Date }>>({});
  // Track if scheduler has been initially loaded to prevent blink on updates
  const initialLoadRef = useRef(true);
  // Track previous event count to detect deletions
  const previousEventCountRef = useRef(0);
  // Track if an operation is in progress to prevent re-parsing
  const operationInProgressRef = useRef(false);

  // LIVE REFS: Wrap props in refs to ensure "Ghost Listeners" always see fresh data
  const onSubmitRef = useRef(onSubmit);
  const roomIdRef = useRef(roomId);
  const currentUserRef = useRef(currentUser);

  // Sync internal ref with prop to avoid stale closures in dhtmlx listeners
  useEffect(() => {
    isCancellingRef.current = !!isCancelling;

    // FAILSAFE: If UI is stuck in "cancelling" mode for > 10s, reset it
    let timeout: any;
    if (isCancelling) {
      timeout = setTimeout(() => {
        console.warn("⚠️ Cancellation failsafe triggered - resetting lock");
        isCancellingRef.current = false;
        if (setIsCancelling) setIsCancelling(false);
      }, 10000);
    }
    return () => clearTimeout(timeout);
  }, [isCancelling, setIsCancelling]);

  // Sync internal ref with prop to avoid stale closures in dhtmlx listeners
  useEffect(() => {
    onSubmitRef.current = onSubmit;
    roomIdRef.current = roomId;
    currentUserRef.current = currentUser;
  }, [onSubmit, roomId, currentUser]);

  // Ref to track events to avoid stale closures in listeners
  const eventRef = useRef(event);
  useEffect(() => {
    eventRef.current = event;
  }, [event]);

  // Helper function to update button UI with optimistic feedback
  const updateButtonUI = useCallback((buttonType: 'save' | 'cancel', state: 'idle' | 'loading' | 'success' | 'error') => {
    const buttonSelectors = buttonType === 'save'
      ? ['[data-section-name="dhx_save_btn"]', '.dhx_save_btn']
      : ['[data-section-name="dhx_cancel_btn"]', '.dhx_cancel_btn'];

    const buttons = document.querySelectorAll(buttonSelectors.join(', '));

    buttons.forEach(button => {
      if (button instanceof HTMLElement) {
        const htmlButton = button as HTMLButtonElement;

        switch (state) {
          case 'loading':
            button.classList.add('loading');
            htmlButton.disabled = true;
            if (buttonType === 'save') {
              button.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                  <div style="width: 16px; height: 16px; border: 2px solid #ffffff; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                  <span>LAGRER...</span>
                </div>
              `;
            } else {
              button.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                  <div style="width: 16px; height: 16px; border: 2px solid #ffffff; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                  <span>AVBRYTER...</span>
                </div>
              `;
            }
            break;

          case 'success':
            button.classList.remove('loading');
            button.classList.add('success');
            htmlButton.disabled = false;
            if (buttonType === 'save') {
              button.innerHTML = 'LAGRET ✓';
            } else {
              button.innerHTML = 'AVBRUTT ✓';
            }
            // Reset to normal state after 1 second
            setTimeout(() => {
              button.classList.remove('success');
              if (buttonType === 'save') {
                button.innerHTML = 'LAGRE';
              } else {
                button.innerHTML = 'AVBRYT';
              }
            }, 1000);
            break;

          case 'error':
            button.classList.remove('loading');
            button.classList.add('error');
            htmlButton.disabled = false;
            if (buttonType === 'save') {
              button.innerHTML = 'FEIL - PRØV IGJEN';
            } else {
              button.innerHTML = 'FEIL - PRØV IGJEN';
            }
            // Reset to normal state after 2 seconds
            setTimeout(() => {
              button.classList.remove('error');
              if (buttonType === 'save') {
                button.innerHTML = 'LAGRE';
              } else {
                button.innerHTML = 'AVBRYT';
              }
            }, 2000);
            break;

          case 'idle':
          default:
            button.classList.remove('loading', 'success', 'error');
            htmlButton.disabled = false;
            if (buttonType === 'save') {
              button.innerHTML = 'LAGRE';
            } else {
              button.innerHTML = 'AVBRYT';
            }
            break;
        }
      }
    });
  }, []);

  // Helper to safely attach scheduler events
  const attachSchedulerEvent = useCallback((name: string, handler: (...args: any[]) => any) => {
    try {
      // @ts-ignore - scheduler.attachEvent exists but may not be typed correctly in this context
      return scheduler.attachEvent(name, handler);
    } catch (e) {
      console.warn(`Failed to attach event ${name}:`, e);
      return null;
    }
  }, []);

  // Helper function to show single toast message
  const showToast = useCallback((action: 'save' | 'cancel', type: 'success' | 'error', operation?: 'create' | 'update') => {
    switch (type) {
      case 'success':
        if (action === 'save') {
          if (operation === 'update') {
            toast.success('Reservasjon oppdatert!');
          } else {
            toast.success('Reservasjon lagret!');
          }
        } else {
          toast.success('Reservasjon avbrutt!');
        }
        break;
      case 'error':
        if (action === 'save') {
          if (operation === 'update') {
            toast.error('Dette tidsrommet er allerede reservert');
          } else {
            toast.error('Kunne ikke lagre reservasjon');
          }
        } else {
          toast.error('Kunne ikke avbryte reservasjon');
        }
        break;
    }
  }, []);

  // Effect to handle loading state on buttons - optimized for responsiveness
  useEffect(() => {
    // Update button states based on current state
    if (buttonStates.save !== 'idle') {
      updateButtonUI('save', buttonStates.save);
    }
    if (buttonStates.cancel !== 'idle') {
      updateButtonUI('cancel', buttonStates.cancel);
    }
  }, [isLoading, buttonStates, updateButtonUI]);

  useEffect(() => {
    isCancellingRef.current = Boolean(isCancelling);
  }, [isCancelling]);

  useEffect(() => {
    // Always update event state when dates prop changes
    // The scheduler will handle duplicate prevention
    const updatedEvents = dates.map((date) => ({
      ...date,
      css: date.start_date < new Date() ? "gray_event" : "red_event",
    }));

    // Check if we have new events that aren't in scheduler yet
    const schedulerEvents = scheduler.getEvents() || [];
    const schedulerIds = new Set(schedulerEvents.map((e: any) => String(e.id)));
    const newEventIds = new Set(updatedEvents.map((e: any) => String(e.id)));

    // Count events in scheduler vs props
    const hasNewEvents = updatedEvents.length > schedulerEvents.length;
    const hasMissingEvents = [...newEventIds].some((id) => !schedulerIds.has(String(id)));

    // If operation is in progress but we have new events from server, still update
    // This handles the case where router.refresh() brings new data
    if (operationInProgressRef.current && !hasNewEvents && !hasMissingEvents) {
      // Skip only if no new events are detected
      return;
    }

    setEvent(updatedEvents);
  }, [dates]);

  useEffect(() => {
    eventRef.current = event;
  }, [event]);

  // Initialize scheduler only once
  const schedulerInitializedRef = useRef(false);

  useEffect(() => {
    if (!schedulerInitializedRef.current) {
      const screenWidth = window.innerWidth;
      const initialViewMode = screenWidth > 600 ? "week" : "day";

      // --- Static Configuration (Run Once) ---
      scheduler.skin = "material";
      scheduler.config.hour_size_px = 40;
      scheduler.config.time_step = 15;
      scheduler.config.scroll_hour = 8;
      scheduler.config.details_on_dblclick = true;
      scheduler.config.details_on_create = true;
      scheduler.config.buttons_left = ["dhx_save_btn", "dhx_cancel_btn", "calender_button"];
      scheduler.config.buttons_right = [];
      scheduler.config.icons_select = [];
      scheduler.config.first_hour = "00";
      scheduler.config.last_hour = "24";
      scheduler.config.fit_events = true;
      scheduler.config.min_event_height = 20;

      // Locales
      scheduler.locale.labels.new_event = "Reservasjon";
      scheduler.locale.labels.icon_save = "lagre";
      scheduler.locale.labels.icon_cancel = "avbryt";
      scheduler.locale.labels.icon_delete = "slett";
      scheduler.locale.labels.confirm_deleting = "Er du sikker på at du ønsker permanent slette denne reservasjonen?";
      scheduler.locale.labels.dhx_cal_today_button = "I DAG";
      scheduler.locale.labels.day_tab = "dag";
      scheduler.locale.labels.week_tab = "uke";
      scheduler.locale.labels["calender_button"] = "";
      scheduler.locale.date.month_full = ["Januar", "Februar", "Mars", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Desember"];
      scheduler.locale.date.month_short = ["Jan", "Feb", "Mar", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Des"];
      scheduler.locale.date.day_full = ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"];
      scheduler.locale.date.day_short = ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"];

      scheduler.config.header = ["prev", "today", "next", "spacer", "date", "spacer", "day", "week"];
      scheduler.xy.scale_width = 70;

      scheduler.init("scheduler_here", new Date(), initialViewMode);

      // Initial time block for past dates
      if (typeof GLOBAL_DISPATCHER.onBeforeViewChange === 'function') {
        GLOBAL_DISPATCHER.onBeforeViewChange(null, null, initialViewMode, new Date());
      }
      schedulerInitializedRef.current = true;
    }
  }, []);

  // Sync Global Guard
  useEffect(() => {
    GLOBAL_ACTIVE_ROOM_ID = roomId;
    return () => {
      // Only clear if we are still the active one (avoids race conditions on fast switch)
      if (GLOBAL_ACTIVE_ROOM_ID === roomId) {
        GLOBAL_ACTIVE_ROOM_ID = null;
      }
    };
  }, [roomId]);

  useEffect(() => {
    if (!schedulerInitializedRef.current) {
      return;
    }

    const currentCount = event.length;
    const schedulerEventsInitial = scheduler.getEvents() || [];

    const toDate = (value: any) => {
      if (value instanceof Date) {
        return new Date(value.getTime());
      }
      return value ? new Date(value) : new Date(NaN);
    };

    const isValidDate = (value: any) => {
      const date = toDate(value);
      return !Number.isNaN(date.getTime());
    };

    const getTime = (value: any) => {
      const date = toDate(value);
      return date.getTime();
    };

    if (initialLoadRef.current) {
      scheduler.clearAll();
      if (currentCount > 0) {
        scheduler.parse(event, "json");
      }
      scheduler.render();
      initialLoadRef.current = false;
      previousEventCountRef.current = currentCount;
      return;
    }

    if (currentCount === 0) {
      if (schedulerEventsInitial.length > 0) {
        scheduler.clearAll();
        scheduler.render();
      }
      previousEventCountRef.current = 0;
      return;
    }

    const propsIds = new Set(event.map((e: any) => String(e.id)));

    schedulerEventsInitial.forEach((se: any) => {
      const idStr = String(se.id);
      if (!propsIds.has(idStr) && !scheduler.getState().new_event) {
        try {
          scheduler.deleteEvent(se.id);
        } catch (_) { }
      }
    });

    let schedulerEvents = scheduler.getEvents() || [];
    const schedulerMap = new Map<string, any>();
    schedulerEvents.forEach((se: any) => {
      schedulerMap.set(String(se.id), se);
    });

    const eventsToAdd: Dates[] = [];

    event.forEach((ev: any) => {
      const idStr = String(ev.id);
      const existing = schedulerMap.get(idStr);

      if (existing) {
        const startChanged = isValidDate(existing.start_date) && isValidDate(ev.start_date)
          ? getTime(existing.start_date) !== getTime(ev.start_date)
          : existing.start_date !== ev.start_date;
        const endChanged = isValidDate(existing.end_date) && isValidDate(ev.end_date)
          ? getTime(existing.end_date) !== getTime(ev.end_date)
          : existing.end_date !== ev.end_date;
        const textChanged = existing.text !== ev.text;
        const cssChanged = existing.css !== ev.css;

        if (startChanged || endChanged || textChanged || cssChanged) {
          existing.start_date = toDate(ev.start_date);
          existing.end_date = toDate(ev.end_date);
          existing.text = ev.text;
          existing.css = ev.css;
          try {
            scheduler.updateEvent(idStr);
          } catch (_) { }
        }
        return;
      }

      const matchingByTime = schedulerEvents.find((se: any) => {
        const seIdStr = String(se.id);
        if (propsIds.has(seIdStr)) {
          return false;
        }
        if (!isValidDate(se.start_date) || !isValidDate(se.end_date) || !isValidDate(ev.start_date) || !isValidDate(ev.end_date)) {
          return false;
        }
        return getTime(se.start_date) === getTime(ev.start_date) && getTime(se.end_date) === getTime(ev.end_date);
      });

      if (matchingByTime) {
        try {
          const oldId = matchingByTime.id;
          scheduler.changeEventId(oldId, idStr);
          const updated = scheduler.getEvent(idStr);
          if (updated) {
            updated.start_date = toDate(ev.start_date);
            updated.end_date = toDate(ev.end_date);
            updated.text = ev.text;
            updated.css = ev.css;
            try {
              scheduler.updateEvent(idStr);
            } catch (_) { }
            schedulerMap.set(idStr, updated);
            schedulerMap.delete(String(oldId));
          }
          schedulerEvents = scheduler.getEvents() || [];
          return;
        } catch (_) {
          // fall back to adding event below
        }
      }

      eventsToAdd.push(ev);
    });

    if (eventsToAdd.length > 0) {
      try {
        scheduler.parse(eventsToAdd, "json");
      } catch (_) { }
    }

    try {
      scheduler.render();
    } catch (_) { }

    previousEventCountRef.current = currentCount;
  }, [event, roomId]); // Re-sync if room changes too

  // Handle global dispatcher registration and scheduler configuration
  useEffect(() => {
    GLOBAL_ACTIVE_ROOM_ID = roomId;

    // 1. Initialize static listeners and templates if not already done
    if (!GLOBAL_LISTENERS_ATTACHED) {
      console.log('🌍 Initializing Global Scheduler Listeners (Run Once)');

      const wrap = (key: string) => (...args: any[]) => {
        if (typeof GLOBAL_DISPATCHER[key] === 'function') {
          return GLOBAL_DISPATCHER[key](...args);
        }
      };

      scheduler.attachEvent("onEventAdded", wrap('onEventAdded'));
      scheduler.attachEvent("onBeforeEventChanged", wrap('onBeforeEventChanged'));
      scheduler.attachEvent("onLightboxButton", wrap('onLightboxButton'));
      scheduler.attachEvent("onBeforeViewChange", wrap('onBeforeViewChange'));
      scheduler.attachEvent("onBeforeDrag", wrap('onBeforeDrag'));
      scheduler.attachEvent("onBeforeLightbox", wrap('onBeforeLightbox'));
      scheduler.attachEvent("onEventChanged", wrap('onEventChanged'));
      scheduler.attachEvent("onBeforeEventDelete", wrap('onBeforeEventDelete'));
      scheduler.attachEvent("onEventDeleted", wrap('onEventDeleted'));
      scheduler.attachEvent("onAfterUpdate", wrap('onAfterUpdate'));

      scheduler.templates.event_class = (start: any, end: any, ev: any) => {
        if (typeof GLOBAL_DISPATCHER.event_class === 'function') {
          return GLOBAL_DISPATCHER.event_class(start, end, ev);
        }
        return ev.css || "employee_event";
      };

      scheduler.templates.month_date_class = (date: any) => date < new Date() ? "gray_section" : "";
      scheduler.templates.day_scale_date = () => ""; // Hide day column header date

      GLOBAL_LISTENERS_ATTACHED = true;
    }

    // 🔥 FIX: Repopulate if UI is empty but state exists (prevents state loss on re-render)
    const currentEvents = scheduler.getEvents() || [];
    const eventList = eventRef.current;
    if (currentEvents.length === 0 && eventList && eventList.length > 0) {
      console.log('🔄 UI was empty but state exists - re-parsing events');
      try {
        scheduler.parse(eventList, "json");
        scheduler.render();
      } catch (_) { }
    }

    // Guard helper inside the effect to ensure it's fresh
    const isEventValid = () => {
      if (roomIdRef.current && GLOBAL_ACTIVE_ROOM_ID !== roomIdRef.current) {
        console.warn(`👻 Ghost event blocked! Ref: ${roomIdRef.current}, Active: ${GLOBAL_ACTIVE_ROOM_ID}`);
        return false;
      }
      return true;
    };

    // 2. Map instance logic to Global Dispatcher
    GLOBAL_DISPATCHER.onEventAdded = async (id: any, ev: any) => {
      if (!isEventValid()) return;

      if (ev.start_date < new Date()) {
        try { scheduler.deleteEvent(id); } catch (_) { }
        toast.error("Du kan ikke reservere i fortiden.");
        return;
      }

      setIsReservation(true);
      const startDate = ev.start_date;
      const endDate = ev.end_date;

      const currentUser = currentUserRef.current;
      const userFullname = currentUser ? `${currentUser.firstname} ${currentUser.lastname}` : "";
      const userEmail = currentUser ? currentUser.email : "";

      const eventText = (ev.text && String(ev.text).trim().length > 0 && ev.text !== "Reservasjon")
        ? ev.text
        : (userFullname || userEmail || "");

      onDateSelect(startDate, endDate, eventText);

      if (!onDataUpdated) return;

      onDataUpdated("create", ev, id);

      // Client-side conflict check (optimistic)
      const conflict = (eventRef.current || []).some((existing) => {
        const existingStart = new Date(existing.start_date).getTime();
        const existingEnd = new Date(existing.end_date).getTime();
        const newStart = new Date(startDate).getTime();
        const newEnd = new Date(endDate).getTime();
        return existingStart < newEnd && existingEnd > newStart;
      });

      if (conflict) {
        try { scheduler.deleteEvent(id); } catch (_) { }
        setButtonStates(prev => ({ ...prev, save: 'error' }));
        toast.error('Dette tidsrommet er allerede reservert.');
        return;
      }

      operationInProgressRef.current = true;
      showToast('save', 'success');
      setButtonStates(prev => ({ ...prev, save: 'success' }));
      scheduler.render();

      try {
        const result = await onSubmitRef.current({ start_date: startDate, end_date: endDate, text: eventText });
        if (result?.id) {
          try { scheduler.changeEventId(id, result.id); } catch (_) { }
        }
        operationInProgressRef.current = false;
        setTimeout(() => setButtonStates(prev => ({ ...prev, save: 'idle' })), 1000);
      } catch (error: any) {
        console.error(`❌ Scheduler - onSubmit failed`, error);

        // 🔥 FIX: Prevent UI state loss. 
        // Instead of JUST deleting, we ensure the scheduler is re-synced with props 
        // if deleting the "newly failed" event leaves the UI empty.
        try {
          scheduler.deleteEvent(id);
          if ((scheduler.getEvents() || []).length === 0 && eventRef.current?.length > 0) {
            scheduler.parse(eventRef.current, "json");
          }
        } catch (_) { }

        setButtonStates(prev => ({ ...prev, save: 'idle' })); // Reset to idle so it can be clicked again
        const errorMessage = error?.response?.data?.error || 'Kunne ikke lagre reservasjon';
        toast.error(errorMessage);
        operationInProgressRef.current = false;
        setTimeout(() => setButtonStates(prev => ({ ...prev, save: 'idle' })), 2000);
      }
    };

    GLOBAL_DISPATCHER.onBeforeEventChanged = (ev: any, e: any, is_new: any, original: any) => {
      if (!isEventValid()) return false;

      // Block moving/resizing into the past
      if (ev.start_date < new Date()) {
        toast.error("Du kan ikke reservere i fortiden.");
        return false;
      }

      if (original) {
        lastEventStateRef.current[String(ev.id)] = {
          start: new Date(original.start_date),
          end: new Date(original.end_date),
        };
      }
      if (original?.css === "red_event") ev.css = "red_event";
      return true;
    };

    GLOBAL_DISPATCHER.onEventChanged = async (id: any, ev: any) => {
      if (!isEventValid()) return;
      if (!onDataUpdated) return;

      // Conflict check for updates
      if ((scheduler.getEvents() || []).some((o: any) => o && String(o.id) !== String(id) && ev.start_date < o.end_date && ev.end_date > o.start_date)) {
        const prev = lastEventStateRef.current[String(id)];
        if (prev) {
          ev.start_date = new Date(prev.start);
          ev.end_date = new Date(prev.end);
          try { scheduler.updateEvent(id); } catch (_) { }
        }
        toast.error('Dette tidsrommet er allerede reservert.');
        return;
      }

      onDataUpdated("update", ev, id);
      operationInProgressRef.current = true;
      setButtonStates(prev => ({ ...prev, save: 'success' }));
      showToast('save', 'success', 'update');

      try {
        await onUpdateReservation(id, { start_date: ev.start_date, end_date: ev.end_date, text: ev.text });
        setTimeout(() => setButtonStates(prev => ({ ...prev, save: 'idle' })), 1000);
      } catch (error) {
        const prev = lastEventStateRef.current[String(id)];
        if (prev) {
          ev.start_date = new Date(prev.start);
          ev.end_date = new Date(prev.end);
          try { scheduler.updateEvent(id); } catch (_) { }
        }
        setButtonStates(prev => ({ ...prev, save: 'error' }));
        toast.error('Kunne ikke oppdatere reservasjon');
        setTimeout(() => setButtonStates(prev => ({ ...prev, save: 'idle' })), 2000);
      } finally {
        operationInProgressRef.current = false;
      }
    };

    GLOBAL_DISPATCHER.onBeforeLightbox = (id: any) => {
      if (!isEventValid()) return false;

      // 🔥 FIX: Hard reset lightbox DOM before opening to prevent "nextSibling of null" errors.
      try {
        if (typeof scheduler.resetLightbox === 'function') {
          scheduler.resetLightbox();
        }
      } catch (_) { }

      const ev = scheduler.getEvent(id);
      const currentUser = currentUserRef.current;
      const currentUserId = currentUser ? currentUser.id : null;

      if (ev && ev.userId && currentUserId !== ev.userId) return false;

      const fallback = (currentUser && (currentUser.firstname || currentUser.lastname))
        ? `${currentUser.firstname} ${currentUser.lastname}`
        : (currentUser ? currentUser.email : "") || "";

      if (!ev.text || ev.text === scheduler.locale.labels.new_event || ev.text === "Reservasjon") {
        ev.text = fallback;
        try { scheduler.updateEvent(id); } catch (_) { }
      }
      return true;
    };

    GLOBAL_DISPATCHER.onLightboxButton = (button_id: any, node: any, e: any, ev: any) => {
      if (!isEventValid()) return false;
      if (button_id === "calender_button") {
        const currentUser = currentUserRef.current;
        const userEmail = currentUser ? currentUser.email : "";
        const link = `https://www.google.com/calendar/event?action=TEMPLATE&text=${encodeURIComponent(ev?.text || "Reservasjon")}&dates=${encodeURIComponent(ev?.start_date)}/${encodeURIComponent(ev?.end_date)}&details=${encodeURIComponent(userEmail || "")}`;
        window.open(link, "_blank");
      }
      if (button_id === "dhx_save_btn") {
        setButtonStates(prev => ({ ...prev, save: 'loading' }));
        return true;
      }
      if (button_id === "dhx_cancel_btn") {
        setButtonStates(prev => ({ ...prev, cancel: 'loading' }));
        scheduler.hideLightbox();
        return false;
      }
    };

    GLOBAL_DISPATCHER.onBeforeEventDelete = () => {
      if (!isEventValid()) return false;
      if (isCancellingRef.current) { toast.error("En annen kansellering pågår."); return false; }
      isCancellingRef.current = true;
      if (setIsCancelling) setIsCancelling(true);
      setButtonStates(prev => ({ ...prev, cancel: 'loading' }));
      return true;
    };

    GLOBAL_DISPATCHER.onEventDeleted = async (id: any, ev: any) => {
      if (!isEventValid()) return;
      if (scheduler.getState().new_event) return;

      const userId = ev ? ev.userId : null;
      const currentUserId = currentUserRef.current ? currentUserRef.current.id : null;

      if (currentUserId && userId && currentUserId === userId && onDataUpdated) {
        onDataUpdated("delete", ev, id);
        try {
          await onCancelReservation(id);
          setButtonStates(prev => ({ ...prev, cancel: 'success' }));
          showToast('cancel', 'success');
        } catch (error) {
          setButtonStates(prev => ({ ...prev, cancel: 'error' }));
          toast.error('Kunne ikke slette reservasjon');
          try {
            if (ev) scheduler.addEvent({ ...ev, id });
          } catch (_) { }
        } finally {
          setTimeout(() => setButtonStates(prev => ({ ...prev, cancel: 'idle' })), 2000);
          isCancellingRef.current = false;
          if (setIsCancelling) setIsCancelling(false);
        }
      } else {
        // Not owner, no userId, or no update callback
        try {
          if (ev) {
            ev.readonly = true;
            scheduler.addEvent({ ...ev, id });
          }
        } catch (_) { }
      }
    };

    GLOBAL_DISPATCHER.onBeforeDrag = (id: any) => {
      if (!isEventValid()) return false;
      const ev = scheduler.getEvent(id);
      const currentUser = currentUserRef.current;
      const currentUserId = currentUser ? currentUser.id : null;
      return !(ev && ev.userId && currentUserId !== ev.userId);
    };

    GLOBAL_DISPATCHER.event_class = (start: any, end: any, ev: any) => ev.css || "employee_event";

    GLOBAL_DISPATCHER.onBeforeViewChange = (old_mode: any, old_date: any, mode: any, date: any) => {
      if (!isEventValid()) return true;

      // Logic to block past dates
      const viewStartDate = scheduler.date[mode + "_start"](new Date(date));
      const effectiveStartDate = (mode === "month") ? scheduler.date.week_start(viewStartDate) : viewStartDate;

      if (markedTimespanRef.current) {
        try { scheduler.deleteMarkedTimespan(markedTimespanRef.current); } catch (_) { }
      }

      markedTimespanRef.current = scheduler.addMarkedTimespan({
        start_date: effectiveStartDate,
        end_date: new Date(),
        zones: "fullday",
        type: "dhx_time_block",
      });

      return true;
    };

    GLOBAL_DISPATCHER.onAfterUpdate = (id: any, action: any) => {
      if (action === "delete") {
        scheduler.config.details_on_dblclick = true;
        scheduler.config.details_on_create = true;
      }
    };

    // 3. Configure instance-specific/dynamic settings
    scheduler.config.hour_date = timeFormatState ? "%H:%i" : "%g:%i %A";

    const currentUser = currentUserRef.current;
    const userDisplay = currentUser ? (`${currentUser.firstname} ${currentUser.lastname}` || currentUser.email) : "";

    scheduler.config.lightbox.sections = [
      {
        name: "Opprettet av", height: 40, type: "textarea", focus: false,
        default_value: userDisplay || "",
        map_to: "text", disabled: true
      },
      { name: "Tid", height: 100, type: "time", map_to: "auto", time_format: ["%H:%i", "%d", "%m", "%Y"] }
    ];

    try {
      scheduler.updateView();
    } catch (_) { }

    return () => {
      // Disconnect this instance from the dispatcher
      Object.keys(GLOBAL_DISPATCHER).forEach(key => {
        if (typeof GLOBAL_DISPATCHER[key] === 'function') GLOBAL_DISPATCHER[key] = null;
      });
      if (markedTimespanRef.current) {
        try { scheduler.deleteMarkedTimespan(markedTimespanRef.current); } catch (_) { }
      }
      try { scheduler.clearAll(); } catch (_) { }
    };
  }, [
    timeFormatState,
    setIsReservation,
    onCancelReservation,
    onUpdateReservation,
    onDataUpdated,
    onDateSelect,
    setButtonStates,
    showToast,
    setIsCancelling,
    roomId
  ]);

  useEffect(() => {
    scheduler.render();
  }, [timeFormatState]);

  const setHoursScaleFormat = (state: any) => {
    scheduler.config.hour_date = state ? "%H:%i" : "%g:%i %A";
    scheduler.templates.hour_scale = scheduler.date.date_to_str(
      scheduler.config.hour_date
    );
  };

  setHoursScaleFormat(timeFormatState);

  return (
    <>
      <div
        ref={schedulerContainerRef}
        id="scheduler_here"
        style={{
          width: "100%",
          height: "100vh", // Use viewport height for scrollable container
          // minHeight: "600px",
          // maxHeight: "calc(100vh - 150px)", // Prevent taking full screen
          overflow: "auto", // Enable scrolling
          border: "1px solid #e5e7eb", // Add subtle border
          borderRadius: "8px" // Rounded corners
        }}
        className=""
      ></div>
    </>
  );
};

export default Scheduler;

// if (currentUser && currentUser.id === ev.userId) {
// } else {
//   ev.readonly = true;
//   scheduler.updateEvent(id);
// }
// scheduler.attachEvent("onBeforeLightbox", function (id: any) {
//   // const event = scheduler.getEvent(id);

//   // Check if the current user is allowed to edit the event
//   // if (event && event.userId && currentUser?.id !== event.userId) {
//   //   return false;
//   // }
//   scheduler.formSection("text").control.value = currentUser?.email || "";

//   // return true;
// });
