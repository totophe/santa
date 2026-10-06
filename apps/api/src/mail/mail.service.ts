import { Inject, Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { CONFIG, type AppConfig } from '../config/env';
import { I18nService, type Language } from '../i18n/i18n.service';

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Sends the (few) transactional emails. No email ever contains a recipient's
 * name, a giver's name, an alias or the text of a message. No tracking pixels,
 * no link redirection.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger('Mail');
  private readonly transport: Transporter | null;

  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly i18n: I18nService,
  ) {
    this.transport = config.smtp.host
      ? createTransport({
          host: config.smtp.host,
          port: config.smtp.port,
          secure: config.smtp.secure,
          auth: config.smtp.user
            ? { user: config.smtp.user, pass: config.smtp.password }
            : undefined,
        })
      : null;
  }

  /** E1 — sign-in code and magic link. */
  async sendSignIn(to: string, code: string, link: string, lang: Language): Promise<void> {
    const subject = this.i18n.t('email.signin.subject', { lang });
    const intro = this.i18n.t('email.signin.intro', { lang });
    const codeLabel = this.i18n.t('email.signin.code_label', { lang });
    const button = this.i18n.t('action.sign_in', { lang });
    const validity = this.i18n.t('email.signin.validity', { lang });

    const html = this.wrap(`
      <p>${intro}</p>
      <p style="font:700 13px system-ui;color:#666">${codeLabel}</p>
      <p style="font:700 34px ui-monospace,Menlo,monospace;letter-spacing:.2em;margin:4px 0 20px">${code}</p>
      <p><a href="${link}" style="display:inline-block;background:#C8102E;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:700">${button}</a></p>
      <p style="color:#888;font-size:13px">${validity}</p>
    `);
    const text = `${intro}\n\n${codeLabel}: ${code}\n\n${button}: ${link}\n\n${validity}`;

    await this.send({ to, subject, html, text });
  }

  /** E2 — invitation to a typed address. */
  async sendInvitation(
    to: string,
    inviterFirstName: string,
    editionName: string,
    link: string,
    unsubscribeUrl: string,
    lang: Language,
  ): Promise<void> {
    const subject = this.i18n.t('email.invitation.subject', { lang, vars: { name: inviterFirstName, edition: editionName } });
    const body = this.i18n.t('email.invitation.body', { lang, vars: { name: inviterFirstName, edition: editionName } });
    const button = this.i18n.t('action.join', { lang });
    const why = this.i18n.t('email.invitation.why', { lang });
    const unsub = this.i18n.t('email.unsubscribe', { lang });
    const html = this.wrap(`
      <p>${body}</p>
      <p><a href="${link}" style="display:inline-block;background:#C8102E;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:700">${button}</a></p>
      <p style="color:#888;font-size:12px">${why}<br><a href="${unsubscribeUrl}" style="color:#888">${unsub}</a></p>
    `);
    const text = `${body}\n\n${button}: ${link}\n\n${why}\n${unsub}: ${unsubscribeUrl}`;
    await this.send({ to, subject, html, text });
  }

  /** E3 — a new edition started (to a ticked existing member). */
  async sendNewEdition(to: string, editionName: string, link: string, lang: Language, theme: string): Promise<void> {
    const subject = this.i18n.t('email.new_edition.subject', { lang, theme, vars: { edition: editionName } });
    const body = this.i18n.t('email.new_edition.body', { lang, theme, vars: { edition: editionName } });
    const button = this.i18n.t('action.im_in', { lang, theme });
    await this.send({ to, subject, ...this.button(body, button, link) });
  }

  /** E5 — your draw has changed (to the one inheriting giver). */
  async sendDrawChanged(to: string, link: string, lang: Language, theme: string): Promise<void> {
    const subject = this.i18n.t('email.draw_changed.subject', { lang, theme });
    const body = this.i18n.t('email.draw_changed.body', { lang, theme });
    const button = this.i18n.t('action.open_draw', { lang, theme });
    await this.send({ to, subject, ...this.button(body, button, link) });
  }

  /** E4 — your draw is ready (no name). */
  async sendDrawReady(to: string, link: string, lang: Language, theme: string): Promise<void> {
    const subject = this.i18n.t('email.draw_ready.subject', { lang, theme });
    const body = this.i18n.t('email.draw_ready.body', { lang, theme });
    const button = this.i18n.t('action.open_draw', { lang, theme });
    await this.send({ to, subject, ...this.button(body, button, link) });
  }

  /** E6 — the group chat is open. */
  async sendChatOpen(to: string, link: string, lang: Language, theme: string): Promise<void> {
    const subject = this.i18n.t('email.chat_open.subject', { lang, theme });
    const body = this.i18n.t('email.chat_open.body', { lang, theme });
    const button = this.i18n.t('action.open_chat', { lang, theme });
    await this.send({ to, subject, ...this.button(body, button, link) });
  }

  private button(body: string, button: string, link: string): { html: string; text: string } {
    const html = this.wrap(`
      <p>${body}</p>
      <p><a href="${link}" style="display:inline-block;background:#C8102E;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:700">${button}</a></p>
    `);
    return { html, text: `${body}\n\n${button}: ${link}` };
  }

  private async send(email: OutgoingEmail): Promise<void> {
    if (!this.transport) {
      this.logger.warn(`[no SMTP configured] would send "${email.subject}" to ${email.to}`);
      this.logger.debug(email.text);
      return;
    }
    await this.transport.sendMail({
      from: this.config.mailFrom,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  }

  /** Shared single-column shell: header, body, footer. Readable without images. */
  private wrap(body: string): string {
    return `<!doctype html><html><body style="margin:0;background:#f0eee9;font-family:system-ui,sans-serif">
      <div style="max-width:480px;margin:0 auto;padding:24px">
        <div style="background:#fff;border-radius:16px;padding:28px">
          <div style="font:700 22px system-ui;color:#C8102E;margin-bottom:16px">${this.config.instanceName}</div>
          ${body}
        </div>
      </div>
    </body></html>`;
  }
}
