/**
 * Utility functions for consistent slug handling
 */

/**
 * Normalizes Norwegian and accented characters to ASCII equivalents
 * MUST run before any sanitization
 *
 * Examples:
 * - Blåkode → Blakode
 * - Møte → Mote
 * - Ærlig → Aerlig
 */
const normalizeCharacters = (input: string): string => {
  return input
    // Norwegian characters (ORDER MATTERS)
    .replace(/å/gi, 'a')
    .replace(/ø/gi, 'o')
    .replace(/æ/gi, 'ae')

    // General accented characters (é → e, ü → u, etc.)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

/**
 * Converts a room name to a normalized URL slug (always lowercase)
 * Example: "Meeting Room B" -> "meeting-room-b"
 */
export const roomNameToSlug = (roomName: string): string => {
  if (!roomName) return '';

  return normalizeCharacters(roomName)
    .trim()
    // Replace non-alphanumeric characters (except spaces and hyphens) with hyphens
    .replace(/[^a-zA-Z0-9\s-]/g, '-')
    // Replace spaces and underscores with hyphens
    .replace(/[\s_]+/g, '-')
    // Collapse multiple hyphens
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
};

/**
 * Converts a URL slug back to a room name format
 * Example: "meeting-room-b" -> "Meeting Room B"
 */
export const slugToRoomName = (slug: string): string => {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Normalizes company name to slug format
 */
export const companyNameToSlug = (companyName: string): string => {
  if (!companyName) return '';

  return normalizeCharacters(companyName)
    .trim()
    .replace(/[^a-zA-Z0-9\s-]/g, '-')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
};

/**
 * Converts company slug back to proper format
 */
export const slugToCompanyName = (slug: string): string => {
  return slug
    .split('-')
    .map(word =>
      word.toUpperCase() === 'AS'
        ? 'AS'
        : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(' ');
};

/**
 * Formats room name for display
 */
export const formatRoomNameForDisplay = (roomName: string): string => {
  if (!roomName) return '';

  if (roomName.includes('-')) {
    return slugToRoomName(roomName);
  }

  return roomName
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Sanitizes and validates room name input
 */
export const sanitizeRoomName = (roomName: string): string => {
  if (!roomName) return '';

  return roomName
    .trim()
    .replace(/[<>"'&\/\\]/g, '')
    .replace(/[^a-zA-Z0-9æøåÆØÅ\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Formats room name for storage in database with proper title case
 */
export const formatRoomNameForStorage = (roomName: string): string => {
  if (!roomName) return '';

  const sanitized = sanitizeRoomName(roomName);

  return sanitized
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};
