import nodemailer from "nodemailer";

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_SECURE,
  SMTP_FROM,
} = process.env;

let transporter;

if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: SMTP_SECURE ? SMTP_SECURE === "true" || SMTP_SECURE === "1" : Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
  transporter.verify().then(() => {
    console.log("SMTP transporter ready");
  }).catch((err) => {
    console.error("SMTP transporter verification failed:", err.message);
  });
} else {
  console.warn("SMTP configuration missing. Email sending will fail until configured.");
}

export async function sendMail({ to, subject, text, html }) {
  if (!transporter) {
    throw new Error("SMTP transporter not configured");
  }
  await transporter.sendMail({
    from: SMTP_FROM || `SocialHub <${SMTP_USER}>`,
    to,
    subject,
    text,
    html,
  });
}
