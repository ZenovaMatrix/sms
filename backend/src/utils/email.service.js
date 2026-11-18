"use strict";

/**
 * email.service.js
 *
 * Production-grade OTP email delivery for EduManage.
 *
 * Priority:
 *   1. Gmail / SMTP (if SMTP_HOST + SMTP_USER + SMTP_PASS configured)
 *   2. Console log fallback (always, so OTP is visible in Vercel function logs)
 *
 * In Vercel production: OTP is always written to function log stream so the
 * admin can retrieve it from the Vercel dashboard → Functions → Logs.
 */

async function sendOtpEmail({ to, name, otp }) {
  try {
    const subject = "EduManage Admin Verification Code";

    const bodyText = [
      `Hello ${name || "Administrator"},`,
      ``,
      `Your 6-digit verification code is: ${otp}`,
      ``,
      `This code expires in 5 minutes.`,
      `If you did not request this, secure your account immediately.`,
      ``,
      `EduManage Security Team`,
    ].join("\n");

    const bodyHtml = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
          <div style="width:36px;height:36px;border-radius:8px;background:#166534;display:flex;align-items:center;justify-content:center;">
            <span style="color:#fff;font-size:20px;font-weight:800;">E</span>
          </div>
          <span style="font-size:1.1rem;font-weight:800;color:#166534;">EduManage Admin Security</span>
        </div>
        <p style="color:#334155;font-size:15px;">Hello <strong>${name || "Administrator"}</strong>,</p>
        <p style="color:#334155;font-size:15px;">Complete your admin login with the verification code below:</p>
        <div style="background:#f0fdf4;border:1.5px dashed #16a34a;border-radius:8px;padding:22px;text-align:center;margin:24px 0;">
          <span style="font-size:36px;font-weight:800;letter-spacing:8px;color:#166534;font-family:monospace;">${otp}</span>
        </div>
        <p style="color:#64748b;font-size:13px;">
          ⏱ This code expires in <strong>5 minutes</strong>.<br/>
          🔒 Never share this code. EduManage staff will never ask for it.
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;"/>
        <p style="color:#94a3b8;font-size:12px;margin:0;">
          © ${new Date().getFullYear()} EduManage Technologies Inc. · Automated security message.
        </p>
      </div>
    `;

    // --- Attempt SMTP delivery ---
    let smtpSent = false;
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const nodemailer = require("nodemailer");

        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT, 10) || 587,
          secure: process.env.SMTP_SECURE === "true",
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
          tls: {
            rejectUnauthorized: false,
          },
        });

        await transporter.sendMail({
          from: process.env.SMTP_FROM || `"EduManage Security" <${process.env.SMTP_USER}>`,
          to,
          subject,
          text: bodyText,
          html: bodyHtml,
        });

        smtpSent = true;
        console.log(`[EmailService] ✓ OTP email delivered via SMTP to: ${to.replace(/(?<=.{3}).(?=.*@)/g, "*")}`);
      } catch (err) {
        console.warn(`[EmailService] SMTP delivery failed: ${err.message}`);
      }
    }

    // --- Always log OTP to server/function logs (for Vercel log access) ---
    if (!smtpSent) {
      if (process.env.NODE_ENV !== "production") {
        console.log("╔════════════════════════════════════════╗");
        console.log("║   [DEV] ADMIN OTP CODE (not emailed)   ║");
        console.log(`║   To:  ${to.padEnd(32)} ║`);
        console.log(`║   OTP: ${otp}                            ║`);
        console.log("║   Expires: 5 minutes                   ║");
        console.log("╚════════════════════════════════════════╝");
      } else {
        console.log("[EmailService][PRODUCTION] OTP generated for:", to.replace(/(?<=.{3}).(?=.*@)/g, "*"));
        console.log("[EmailService][OTP_DELIVERY] Code:", otp, "| Recipient:", to, "| Expires: 5min");
      }
    }

    return { sent: smtpSent, method: smtpSent ? "smtp" : "log" };
  } catch (err) {
    console.warn("[EmailService] Top-level sendOtpEmail notice:", err.message);
    return { sent: false, method: "fallback" };
  }
}

async function sendAccountActivationEmail({ to, name, role, password, isResend = false }) {
  const roleDisplayNames = {
    admin: "Institution Administrator",
    teacher: "Faculty / Teacher",
    librarian: "Institutional Librarian",
    student: "Student",
    parent: "Parent / Guardian",
  };

  const roleName = roleDisplayNames[role] || role;
  const subject = isResend
    ? `EduManage Account Activation Reminder - ${roleName}`
    : `Welcome to EduManage - Your ${roleName} Account Has Been Created`;

  const bodyText = [
    `Hello ${name || "Staff Member"},`,
    ``,
    `Your official ${roleName} account on the EduManage School Management System has been ${isResend ? "updated" : "provisioned"} by Institution Management.`,
    ``,
    `Portal Login URL: ${process.env.FRONTEND_URL || "https://edumanage-teal.vercel.app"}/login`,
    `Registered Email: ${to}`,
    password ? `Initial Password: ${password}` : `Please use your existing credentials or request a password reset upon login.`,
    ``,
    role === "admin"
      ? `Important: Administrator access requires two-factor authentication (2FA). A 6-digit OTP will be dispatched to this email upon password entry.`
      : `You may now access your dedicated ${roleName} dashboard immediately after signing in.`,
    ``,
    `Regards,`,
    `Institution Management Team`,
    `EduManage Educational Systems`,
  ].join("\n");

  const bodyHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff;">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px; border-bottom: 2px solid #166534; padding-bottom: 16px;">
        <div style="width: 40px; height: 40px; border-radius: 8px; background: #166534; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold;">
          E
        </div>
        <div>
          <h2 style="margin: 0; color: #166534; font-size: 20px;">EduManage Institution Management</h2>
          <span style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Staff Account Provisioning</span>
        </div>
      </div>

      <p style="color: #334155; font-size: 15px;">Hello <strong>${name || "Staff Member"}</strong>,</p>
      <p style="color: #334155; font-size: 14px; line-height: 1.6;">
        Your institutional account has been successfully ${isResend ? "re-activated and invitation resent" : "created and authorized"} by school administration.
      </p>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 18px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 6px 0; color: #64748b; width: 140px;">Assigned Role:</td>
            <td style="padding: 6px 0; font-weight: 700; color: #166534;">${roleName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Login Email:</td>
            <td style="padding: 6px 0; font-weight: 600; color: #1e293b;">${to}</td>
          </tr>
          ${password ? `
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Initial Password:</td>
            <td style="padding: 6px 0; font-family: monospace; font-weight: 700; color: #0f172a; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; display: inline-block;">${password}</td>
          </tr>` : ""}
        </table>
      </div>

      ${role === "admin" ? `
      <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 12px 16px; margin-bottom: 20px; border-radius: 0 4px 4px 0;">
        <strong style="color: #065f46; font-size: 13px;">🛡️ Enhanced 2FA Security Protected:</strong>
        <p style="margin: 4px 0 0 0; color: #047857; font-size: 12px;">Administrator access requires dual-factor authentication. A secure 6-digit OTP will be dispatched to this email upon password verification.</p>
      </div>` : ""}

      <div style="text-align: center; margin: 28px 0;">
        <a href="${process.env.FRONTEND_URL || "https://edumanage-teal.vercel.app"}/login" style="background-color: #166534; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block;">
          Sign In to ${roleName} Portal
        </a>
      </div>

      <p style="color: #64748b; font-size: 12px; margin-top: 24px; line-height: 1.5;">
        Please change your password after initial login. If you believe this account was provisioned in error, contact your institutional IT administrator immediately.
      </p>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
        © ${new Date().getFullYear()} EduManage Educational Technologies. All rights reserved.
      </p>
    </div>
  `;

  let smtpSent = false;
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const nodemailer = require("nodemailer");
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT, 10) || 587,
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: { rejectUnauthorized: false },
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || `"EduManage Institution Management" <${process.env.SMTP_USER}>`,
        to,
        subject,
        text: bodyText,
        html: bodyHtml,
      });

      smtpSent = true;
      console.log(`[EmailService] ✓ Activation email sent via SMTP to: ${to}`);
    } catch (err) {
      console.warn(`[EmailService] Activation email SMTP failed: ${err.message}`);
    }
  }

  if (!smtpSent) {
    console.log(`[EmailService] Activation email processed for: ${to} (Role: ${role}, Resend: ${isResend})`);
  }

  return { sent: smtpSent, method: smtpSent ? "smtp" : "log" };
}

module.exports = { sendOtpEmail, sendAccountActivationEmail };
