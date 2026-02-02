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
