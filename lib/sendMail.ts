import sgMail from "@sendgrid/mail";

// Initialize once
sgMail.setApiKey(process.env.SENDGRID_API_KEY as string);

const FROM_EMAIL =
  process.env.SENDGRID_SENDER_EMAIL ||
  process.env.EMAIL_FROM ||
  "";

// Base sender (no transporters, no verification)
const sendEmail = async (
  email: string,
  text: string,
  subject: string,
  htmlContent: string
) => {
  const msg = {
    to: email,
    from: FROM_EMAIL,
    subject,
    text,
    html: htmlContent,
  };

  const [response] = await sgMail.send(msg);
  return response;
};

export const sendInvitaionLinkMail = async (
  email: string,
  text: string,
  subject: string,
  htmlContent: string
) => {
  try {
    return await sendEmail(email, text, subject, htmlContent);
  } catch (error: any) {
    console.error(
      "Email sending failed:",
      error?.response?.body || error.message
    );
    throw new Error("Email sending failed");
  }
};

export const sendCreationMail = async (
  email: string,
  text: string,
  subject: string,
  htmlContent: string
) => {
  try {
    return await sendEmail(email, text, subject, htmlContent);
  } catch (error: any) {
    console.log("epost ikke sendt!");
    console.log(error?.response?.body || error.message);
    return error;
  }
};

export const sendUpdateMail = async (
  email: string,
  text: string,
  subject: string,
  htmlContent: string
) => {
  try {
    return await sendEmail(email, text, subject, htmlContent);
  } catch (error: any) {
    console.log("epost ikke sendt!");
    console.log(error?.response?.body || error.message);
    return error;
  }
};

export const sendCancellationMail = async (
  email: string,
  reservationText: string,
  reservationTime: string,
  companyName: string
) => {
  const subject = `Kansellert: ${reservationText}`;
  const text = `Din reservasjon for "${reservationText}" hos ${companyName} kl. ${reservationTime} har blitt kansellert.`;
  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4F518C;">Reservasjon kansellert</h2>
      <p>Hei,</p>
      <p>Din reservasjon har blitt kansellert:</p>
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Hva:</strong> ${reservationText}</p>
        <p><strong>Tid:</strong> ${reservationTime}</p>
        <p><strong>Sted:</strong> ${companyName}</p>
      </div>
      <p>Vennlig hilsen,<br/>${companyName}</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="font-size: 12px; color: #6b7280;">Dette er en automatisk melding fra holdav.no</p>
    </div>
  `;

  try {
    return await sendEmail(email, text, subject, htmlContent);
  } catch (error: any) {
    console.error("Cancellation email failed:", error?.response?.body || error.message);
  }
};

export const sendResetPasswordMail = async (
  email: string,
  resetLink: string,
  companyName: string = "Holdav.no"
) => {
  const subject = `Tilbakestill ditt passord - ${companyName}`;
  const text = `Klikk på følgende lenke for å tilbakestille ditt passord: ${resetLink}. Denne lenken er gyldig i 1 time.`;
  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4F518C;">Tilbakestill passord</h2>
      <p>Hei,</p>
      <p>Vi har mottatt en forespørsel om å tilbakestille passordet for din konto hos ${companyName}.</p>
      <p>Klikk på knappen nedenfor for å velge et nytt passord:</p>
      <div style="margin: 30px 0;">
        <a href="${resetLink}" style="background-color: #4F518C; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Tilbakestill passord</a>
      </div>
      <p>Hvis knappen ikke fungerer, kan du kopiere og lime inn denne lenken i nettleseren din:</p>
      <p style="word-break: break-all; color: #6b7280; font-size: 14px;">${resetLink}</p>
      <p>Denne lenken vil utløpe om 1 time.</p>
      <p>Hvis du ikke ba om dette, kan du trygt se bort fra denne e-posten.</p>
      <p>Vennlig hilsen,<br/>${companyName}</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="font-size: 12px; color: #6b7280;">Dette er en automatisk melding fra holdav.no</p>
    </div>
  `;

  try {
    return await sendEmail(email, text, subject, htmlContent);
  } catch (error: any) {
    console.error("Reset password email failed:", error?.response?.body || error.message);
  }
};

export const sendWelcomeMail = async (
  email: string,
  name: string,
  role: 'admin' | 'user',
  companyName?: string
) => {
  const isUser = role === 'user';
  const subject = isUser
    ? `Velkommen til ${companyName || 'Holdav.no'}`
    : "Velkommen til Holdav.no - Ditt nye bookingsystem";

  const text = isUser
    ? `Hei ${name}! Velkommen som bruker hos ${companyName}. Du kan nå logge inn og reservere møterom.`
    : `Hei ${name}! Takk for at du valgte Holdav.no. Du har nå opprettet din admin-bruker og kan starte med å sette opp ditt selskap og dine møterom.`;

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #374151;">
      <h2 style="color: #4F518C;">Velkommen til Holdav.no!</h2>
      <p>Hei ${name},</p>
      ${isUser ? `
        <p>Vi er glade for å ha deg med oss! Din bruker er nå aktivert for <strong>${companyName}</strong>.</p>
        <p>Du kan nå logge inn på systemet for å se tilgjengelige møterom og legge inn dine egne reservasjoner.</p>
      ` : `
        <p>Takk for at du valgte Holdav.no som ditt bookingsystem!</p>
        <p>Du har nå opprettet din admin-konto. Som administrator kan du:</p>
        <ul style="line-height: 1.6;">
          <li>Opprette og administrere møterom</li>
          <li>Invitere dine kolleger/brukere</li>
          <li>Se oversikt over alle reservasjoner i ditt selskap</li>
        </ul>
        <p>Kom i gang ved å opprette ditt første møterom i kontrollpanelet.</p>
      `}
      <div style="margin: 30px 0; text-align: center;">
        <a href="https://holdav.no/login" style="background-color: #4F518C; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Logg inn nå</a>
      </div>
      <p>Hvis du har spørsmål, er det bare å svare på denne e-posten.</p>
      <p>Vennlig hilsen,<br/>Holdav-teamet</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="font-size: 12px; color: #6b7280; text-align: center;">Dette er en automatisk velkomstmelding fra holdav.no</p>
    </div>
  `;

  try {
    return await sendEmail(email, text, subject, htmlContent);
  } catch (error: any) {
    console.error("Welcome email failed:", error?.response?.body || error.message);
  }
};
