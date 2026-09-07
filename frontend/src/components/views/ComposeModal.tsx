import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { Sender, User } from '../../types';
import type { ParseResult } from '../../utils/csv';
import { Button } from '../ui/Button';
import { FileUpload } from '../ui/FileUpload';
import { Modal } from '../ui/Modal';

export interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onScheduleSuccess: (count: number) => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onScheduleSuccess,
}) => {
  const [senders, setSenders] = useState<Sender[]>([]);
  const [selectedSenderId, setSelectedSenderId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  // Rich text editor active formatting state (for visual representation)
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);

  // Default start time: current time formatted as YYYY-MM-DDTHH:mm
  const getDefaultStartTime = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 2); // default 2 mins in future
    return d.toISOString().slice(0, 16);
  };

  const [startTime, setStartTime] = useState(getDefaultStartTime());
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(100);

  // File parse state
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [manualRecipients, setManualRecipients] = useState('');

  // Scheduling state
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      api
        .getSenders()
        .then((res) => {
          if (res.data && res.data.length > 0) {
            setSenders(res.data);
            setSelectedSenderId(res.data[0].id);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // Compute final valid recipient list (combining uploaded CSV + manual input)
  const getCombinedRecipients = (): string[] => {
    const fileEmails = parseResult?.valid || [];
    const manualEmails = manualRecipients
      .split(/[\r\n,;\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(e));

    const combined = Array.from(new Set([...fileEmails, ...manualEmails]));
    return combined;
  };

  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};
    const recipients = getCombinedRecipients();

    if (!subject.trim()) {
      errs.subject = 'Subject line is required';
    }
    if (!body.trim()) {
      errs.body = 'Email body content is required';
    }
    if (!selectedSenderId) {
      errs.sender = 'Sender identity must be selected';
    }
    if (recipients.length === 0) {
      errs.recipients = 'At least one valid recipient email is required (upload CSV/TXT or type manually)';
    }
    if (!startTime) {
      errs.startTime = 'Start time is required';
    } else {
      const parsedDate = new Date(startTime);
      if (isNaN(parsedDate.getTime())) {
        errs.startTime = 'Invalid datetime format';
      }
    }
    if (isNaN(delaySeconds) || delaySeconds < 0) {
      errs.delay = 'Delay must be 0 or a positive number';
    }
    if (isNaN(hourlyLimit) || hourlyLimit <= 0) {
      errs.hourlyLimit = 'Hourly limit must be greater than 0';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    setErrors({});

    const recipients = getCombinedRecipients();
    const startTimeIso = new Date(startTime).toISOString();
    const delayBetweenMs = delaySeconds * 1000;

    try {
      if (recipients.length === 1) {
        // Single schedule
        await api.scheduleEmail({
          userId: currentUser.id,
          senderId: selectedSenderId,
          recipient: recipients[0],
          subject,
          body,
          scheduledAt: startTimeIso,
          idempotencyKey: `single-${currentUser.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        });
        onScheduleSuccess(1);
      } else {
        // Bulk schedule
        const res = await api.bulkScheduleEmails({
          userId: currentUser.id,
          senderId: selectedSenderId,
          recipients,
          subject,
          body,
          startTime: startTimeIso,
          delayBetweenMs,
        });
        onScheduleSuccess(res.data.scheduledCount);
      }

      // Reset form
      setSubject('');
      setBody('');
      setParseResult(null);
      setFilename(null);
      setManualRecipients('');
      onClose();
    } catch (err: any) {
      setErrors({ submit: err.message || 'Failed to schedule emails' });
    } finally {
      setSubmitting(false);
    }
  };

  const activeRecipientsCount = getCombinedRecipients().length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      maxWidth="4xl"
    >
      <div className="space-y-6">
        {/* Custom Header matching attached reference mockup */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-brand-border pb-5">
          <div>
            <span className="text-[11px] font-bold tracking-widest text-brand-gold uppercase block mb-1">
              CREATE CAMPAIGN
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold font-serif text-brand-text tracking-tight">
              Compose & Schedule Email Campaign
            </h2>
            <p className="mt-1 text-xs text-brand-muted">
              Configure bulk email parameters, upload recipient lists, and set send delays.
            </p>
          </div>

          {/* Sparkle Banner on Top Right */}
          <div className="relative overflow-hidden rounded-2xl border border-brand-gold/30 bg-gradient-to-r from-brand-gold-soft to-[#FDFBF7] p-3.5 sm:w-64 gold-wave-bg shadow-2xs">
            <div className="flex items-start space-x-2.5">
              <span className="text-brand-gold text-lg">✦</span>
              <div>
                <p className="text-xs font-bold text-brand-text leading-snug">
                  Turn conversations
                </p>
                <p className="text-xs font-bold text-brand-text leading-snug">
                  into opportunities.
                </p>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSchedule} className="space-y-6">
          {errors.submit && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 font-semibold">
              {errors.submit}
            </div>
          )}

          {/* Main Form Content: 2 Columns on Desktop */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* LEFT COLUMN: Sender, Subject, Rich Body */}
            <div className="space-y-4">
              {/* Sender Identity */}
              <div>
                <label className="block text-xs font-bold text-brand-text mb-1.5">
                  Sender Identity
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-brand-muted">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.8}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <select
                    value={selectedSenderId}
                    onChange={(e) => setSelectedSenderId(e.target.value)}
                    className="w-full rounded-xl border border-brand-border bg-white pl-9 pr-8 py-2.5 text-xs font-medium text-brand-text focus:border-brand-gold focus:outline-none focus:ring-2 focus:ring-brand-gold/20 shadow-2xs appearance-none"
                  >
                    {senders.length > 0 ? (
                      senders.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.displayName} ({s.email})
                        </option>
                      ))
                    ) : (
                      <option value="">Loading sender identities...</option>
                    )}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-brand-muted">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {errors.sender && <p className="text-xs text-red-600 mt-1">{errors.sender}</p>}
              </div>

              {/* Email Subject */}
              <div>
                <label className="block text-xs font-bold text-brand-text mb-1.5">
                  Email Subject
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Enter email subject line..."
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded-xl border border-brand-border bg-white px-3.5 py-2.5 text-xs text-brand-text placeholder-brand-muted focus:border-brand-gold focus:outline-none focus:ring-2 focus:ring-brand-gold/20 shadow-2xs"
                  />
                </div>
                <div className="flex justify-between items-center mt-1">
                  {errors.subject ? (
                    <p className="text-xs text-red-600">{errors.subject}</p>
                  ) : (
                    <span />
                  )}
                  <span className="text-[11px] text-brand-muted font-sans">
                    {subject.length}/100
                  </span>
                </div>
              </div>

              {/* Email Body Content (Rich Text Editor UI Container) */}
              <div>
                <label className="block text-xs font-bold text-brand-text mb-1.5">
                  Email Body Content
                </label>

                <div className="rounded-xl border border-brand-border bg-white shadow-2xs overflow-hidden">
                  {/* Rich Text Editor Minimal Toolbar */}
                  <div className="flex flex-wrap items-center gap-1 border-b border-brand-border bg-brand-cream-soft px-2.5 py-1.5 text-xs">
                    <select className="rounded-lg border border-brand-border bg-white px-2 py-1 text-[11px] font-medium text-brand-text focus:outline-none">
                      <option>Normal</option>
                      <option>Heading 1</option>
                      <option>Heading 2</option>
                    </select>

                    <div className="h-4 w-px bg-brand-border mx-1" />

                    <button
                      type="button"
                      onClick={() => setIsBold(!isBold)}
                      className={`rounded px-2 py-1 font-bold text-xs transition ${
                        isBold ? 'bg-brand-gold-soft text-brand-gold-dark' : 'text-brand-text hover:bg-brand-cream'
                      }`}
                      title="Bold"
                    >
                      B
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsItalic(!isItalic)}
                      className={`rounded px-2 py-1 italic font-serif text-xs transition ${
                        isItalic ? 'bg-brand-gold-soft text-brand-gold-dark' : 'text-brand-text hover:bg-brand-cream'
                      }`}
                      title="Italic"
                    >
                      I
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsUnderline(!isUnderline)}
                      className={`rounded px-2 py-1 underline text-xs transition ${
                        isUnderline ? 'bg-brand-gold-soft text-brand-gold-dark' : 'text-brand-text hover:bg-brand-cream'
                      }`}
                      title="Underline"
                    >
                      U
                    </button>

                    <div className="h-4 w-px bg-brand-border mx-1" />

                    <button
                      type="button"
                      className="rounded p-1 text-brand-text hover:bg-brand-cream transition"
                      title="Bullet list"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="rounded p-1 text-brand-text hover:bg-brand-cream transition"
                      title="Numbered list"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h13M7 12h13M7 16h13M3 8h.01M3 12h.01M3 16h.01" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="rounded p-1 text-brand-text hover:bg-brand-cream transition"
                      title="Insert Link"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    </button>
                  </div>

                  {/* Body Textarea */}
                  <textarea
                    rows={5}
                    placeholder="Write your campaign body message here..."
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className={`w-full bg-white px-3.5 py-2.5 text-xs text-brand-text placeholder-brand-muted focus:outline-none resize-y ${
                      isBold ? 'font-bold' : ''
                    } ${isItalic ? 'italic' : ''} ${isUnderline ? 'underline' : ''}`}
                  />
                </div>

                <div className="flex justify-between items-center mt-1">
                  {errors.body ? (
                    <p className="text-xs text-red-600">{errors.body}</p>
                  ) : (
                    <span />
                  )}
                  <span className="text-[11px] text-brand-muted font-sans">
                    {body.length}/5000
                  </span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Recipients CSV/TXT & Manual Input */}
            <div className="space-y-4">
              <FileUpload
                parsedResult={parseResult}
                filename={filename}
                onParsed={(res, fname) => {
                  setParseResult(res);
                  setFilename(fname);
                }}
                onClear={() => {
                  setParseResult(null);
                  setFilename(null);
                }}
              />

              {/* Manual Recipients Input */}
              <div>
                <label className="block text-xs font-bold text-brand-text mb-1.5">
                  Manual Recipient Emails (Comma/Newline Separated)
                </label>
                <textarea
                  rows={3}
                  placeholder="vyshnavireddychaganti12@gmail.com, alex@example.com"
                  value={manualRecipients}
                  onChange={(e) => setManualRecipients(e.target.value)}
                  className="w-full rounded-xl border border-brand-border bg-white px-3.5 py-2 text-xs text-brand-text placeholder-brand-muted focus:border-brand-gold focus:outline-none focus:ring-2 focus:ring-brand-gold/20 shadow-2xs"
                />
                <p className="text-[11px] text-brand-muted mt-1">
                  Enter one or more email addresses separated by commas or new lines
                </p>
                {errors.recipients && (
                  <p className="text-xs text-red-600 mt-1 font-semibold">{errors.recipients}</p>
                )}
              </div>
            </div>
          </div>

          {/* FULL WIDTH BOTTOM ROW: Timing & Spacing Controls */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 border-t border-brand-border/60 pt-5">
            {/* Start Time */}
            <div>
              <label className="block text-xs font-bold text-brand-text mb-1.5">
                Start Time
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-brand-muted">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-xl border border-brand-border bg-white pl-9 pr-3 py-2 text-xs text-brand-text focus:border-brand-gold focus:outline-none focus:ring-2 focus:ring-brand-gold/20 shadow-2xs"
                />
              </div>
              {errors.startTime && <p className="text-xs text-red-600 mt-1">{errors.startTime}</p>}
            </div>

            {/* Delay Between Emails */}
            <div>
              <label className="block text-xs font-bold text-brand-text mb-1.5">
                Delay Between Emails (sec)
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-brand-muted">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 7v5l3 3" />
                  </svg>
                </div>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={delaySeconds}
                  onChange={(e) => setDelaySeconds(parseFloat(e.target.value))}
                  className="w-full rounded-xl border border-brand-border bg-white pl-9 pr-3 py-2 text-xs text-brand-text focus:border-brand-gold focus:outline-none focus:ring-2 focus:ring-brand-gold/20 shadow-2xs"
                />
              </div>
              <p className="text-[11px] text-brand-muted mt-1">Spacing between sends</p>
              {errors.delay && <p className="text-xs text-red-600 mt-1">{errors.delay}</p>}
            </div>

            {/* Hourly Limit */}
            <div>
              <label className="block text-xs font-bold text-brand-text mb-1.5">
                Hourly Limit
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-brand-muted">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <input
                  type="number"
                  min={1}
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10))}
                  className="w-full rounded-xl border border-brand-border bg-white pl-9 pr-3 py-2 text-xs text-brand-text focus:border-brand-gold focus:outline-none focus:ring-2 focus:ring-brand-gold/20 shadow-2xs"
                />
              </div>
              <p className="text-[11px] text-brand-muted mt-1">Max emails per hour</p>
              {errors.hourlyLimit && <p className="text-xs text-red-600 mt-1">{errors.hourlyLimit}</p>}
            </div>
          </div>

          {/* Action Buttons (Bottom Right) */}
          <div className="flex items-center justify-end space-x-3 border-t border-brand-border/60 pt-4">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2.5 font-semibold text-brand-text bg-white border-brand-border hover:bg-brand-cream"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={submitting}
              className="px-6 py-2.5 font-semibold text-white bg-brand-black hover:bg-brand-black-card shadow-md flex items-center gap-2"
            >
              <svg className="h-4 w-4 transform -rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              <span>
                {submitting
                  ? 'Scheduling...'
                  : `Schedule ${activeRecipientsCount > 0 ? activeRecipientsCount : 1} Email${activeRecipientsCount > 1 ? 's' : ''}`}
              </span>
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

