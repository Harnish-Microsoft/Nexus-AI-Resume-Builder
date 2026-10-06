import React from 'react';
import type { EvidenceStatus, EvidenceTierSummary, RequirementEvidenceReport } from '../lib/requirementEvidence';
import type { DraftVerificationReport } from '../lib/draftReview';
import type { InputCoverageReport } from '../lib/inputCoverage';

interface RequirementEvidenceCardProps {
  evidence?: RequirementEvidenceReport;
  verification?: DraftVerificationReport;
  coverage?: InputCoverageReport;
  isDarkMode: boolean;
}

const STATUS_ORDER: EvidenceStatus[] = ['evidenced', 'partial', 'not_evidenced', 'excluded'];

const STATUS_LABEL: Record<EvidenceStatus, string> = {
  evidenced: 'Proven',
  partial: 'Partly proven',
  not_evidenced: 'Not evidenced',
  excluded: 'Excluded by you',
};

const STATUS_HINT: Record<EvidenceStatus, string> = {
  evidenced: 'Your own material shows this; the quote below was found in it.',
  partial: 'Your material shows related work, not the full requirement. The resume claims only what the evidence shows.',
  not_evidenced: 'Nothing in your material shows this, so the resume does not claim it. Add it to your master resume or brain dump only if it is true.',
  excluded: 'You chose not to claim this capability, so the resume never names it.',
};

const STATUS_TONE: Record<EvidenceStatus, string> = {
  evidenced: 'text-emerald-500',
  partial: 'text-amber-500',
  not_evidenced: 'text-rose-500',
  excluded: 'opacity-60',
};

const ISSUE_LABEL: Record<string, string> = {
  excluded_term: 'Excluded skill',
  unsupported_figure: 'Unverified figure',
  unsupported_term: 'Not in your material',
  unsupported_skill: 'Unsupported skill',
  unsupported_claim: 'Unsupported claim',
  missed_evidence: 'Proof not shown',
};

function list<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function percentTone(value: number): string {
  return value >= 70 ? 'text-emerald-500' : value >= 45 ? 'text-amber-500' : 'text-rose-500';
}

function verificationSummary(report: DraftVerificationReport): string {
  const fixed = list(report.fixed).length;
  const remaining = list(report.remaining).length;
  const counts =
    report.issues_found > 0 || remaining > 0
      ? `${report.issues_found} issue${report.issues_found === 1 ? '' : 's'} found, ${fixed} corrected, ${remaining} left for you to review.`
      : 'No problems found.';
  if (report.ai_review === 'skipped') return `Checked in code only (fast mode). ${counts}`;
  if (report.ai_review === 'failed') return `AI review unavailable, so only the checks in code ran. ${counts}`;
  if (report.corrections === 'failed') return `${counts} The correction step failed, so nothing was rewritten.`;
  return counts;
}

/**
 * What the candidate's own material proves for each posting requirement - kept
 * apart from keyword coverage, which measures wording - plus the review of the
 * draft and anything the pipeline could not read.
 */
export const RequirementEvidenceCard: React.FC<RequirementEvidenceCardProps> = ({ evidence, verification, coverage, isDarkMode }) => {
  const requirements = list(evidence?.requirements);
  const notes = list(coverage?.notes);
  if (requirements.length === 0 && !verification && notes.length === 0) return null;

  const divider = 'mt-3 pt-3 border-t border-white/10';
  const tierRow = (label: string, tier?: EvidenceTierSummary) =>
    tier && tier.total > 0 ? (
      <div className="flex items-center justify-between gap-3 text-[11px]">
        <span className="font-bold">{label}</span>
        <span className="tabular-nums whitespace-nowrap">
          <span className="font-bold text-emerald-500">{tier.evidenced}</span>
          <span className="opacity-60"> / {tier.total} proven</span>
          {tier.partial > 0 && <span className="text-amber-500"> · {tier.partial} partly</span>}
          {tier.excluded > 0 && <span className="opacity-50"> · {tier.excluded} excluded</span>}
        </span>
      </div>
    ) : null;

  const remaining = list(verification?.remaining);
  const fixed = list(verification?.fixed);
  const removed = list(verification?.removed);
  const hardGaps = list(evidence?.hard_gaps);
  const score = evidence?.qualification_evidence;

  return (
    <div className={`p-4 rounded-xl border ${isDarkMode ? 'glass-panel border-white/10' : 'glass-panel-light border-black/5'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className={`text-xs font-bold uppercase tracking-widest ${isDarkMode ? 'text-amber-300' : 'text-amber-700'}`}>
            Requirement Evidence
          </h3>
          <p className="text-[10px] mt-1 opacity-70">
            {requirements.length > 0
              ? 'What your own resume and notes prove for this posting. Rewording the resume cannot change it.'
              : 'How the draft was checked against your own material.'}
          </p>
        </div>
        {typeof score === 'number' && (
          <div className="text-right" title="Required requirements count fully, nice-to-haves half; partly proven counts half.">
            <span className="text-[10px] uppercase tracking-widest opacity-60 block">Proven</span>
            <span className={`font-bold text-2xl ${percentTone(score)}`}>{score}%</span>
          </div>
        )}
      </div>

      {requirements.length > 0 && (
        <div className={`${divider} space-y-1`}>
          {tierRow('Required', evidence?.required)}
          {tierRow('Nice-to-have', evidence?.preferred)}
          {hardGaps.length > 0 && (
            <p className="text-[10px] text-rose-500 pt-1">
              <span className="font-bold">Eligibility gaps:</span> {hardGaps.join('; ')}
            </p>
          )}
        </div>
      )}

      {requirements.length > 0 && (
        <div className={`${divider} space-y-2`}>
          {STATUS_ORDER.map((status) => {
            const group = requirements.filter((requirement) => requirement.status === status);
            if (group.length === 0) return null;
            return (
              <details key={status} open={status !== 'excluded'}>
                <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-widest" title={STATUS_HINT[status]}>
                  <span className={STATUS_TONE[status]}>{STATUS_LABEL[status]}</span>
                  <span className="opacity-50"> ({group.length})</span>
                </summary>
                <ul className="mt-1 space-y-1.5">
                  {group.map((requirement) => {
                    const quote = list(requirement.evidence)[0];
                    const where = quote
                      ? quote.source === 'brain_dump'
                        ? 'your notes'
                                          : quote.source === 'other_resume'
                                            ? ['your other resume', [quote.role, quote.company].filter(Boolean).join(' @ ')].filter(Boolean).join(', ')
                                            : [quote.role, quote.company].filter(Boolean).join(' @ ')
                                        : '';
                    return (
                      <li key={requirement.id} className="text-[10px] leading-relaxed">
                        <span className="opacity-90">{requirement.text}</span>
                        <span className="opacity-40">
                          {' '}&middot; {requirement.tier === 'required' ? 'required' : 'nice-to-have'}
                          {requirement.hard_gate ? ' \u00b7 eligibility' : ''}
                        </span>
                        {quote && (
                          <p
                            className="opacity-50 italic truncate"
                            title={list(requirement.evidence).map((q) => q.text).join('\n')}
                          >
                            &ldquo;{quote.text}&rdquo;{where ? ` \u2014 ${where}` : ''}
                          </p>
                        )}
                        {requirement.note && status !== 'evidenced' && <p className="opacity-50">{requirement.note}</p>}
                        {requirement.claimed_status && status === 'not_evidenced' && (
                          <p className="opacity-40">The AI claimed evidence, but its quote was not found in your material.</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </details>
            );
          })}
        </div>
      )}

      {verification && (
        <div className={`${divider} space-y-1.5`}>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Draft check</p>
          <p className="text-[10px] opacity-70">{verificationSummary(verification)}</p>
          {remaining.slice(0, 6).map((issue, idx) => (
            <div key={`${issue.location}-${issue.type}-${idx}`} className="text-[10px] leading-relaxed">
              <span className="font-bold uppercase tracking-wider mr-1 text-amber-500">{ISSUE_LABEL[issue.type] || issue.type}</span>
              <span className="opacity-60">{issue.label}: </span>
              <span className="opacity-80">{issue.problem}</span>
              {issue.text && <p className="opacity-40 italic truncate" title={issue.text}>&ldquo;{issue.text}&rdquo;</p>}
            </div>
          ))}
          {remaining.length > 6 && <p className="text-[10px] opacity-50">+{remaining.length - 6} more</p>}
          {fixed.length > 0 && (
            <details>
              <summary className="cursor-pointer text-[10px] opacity-60">{fixed.length} corrected before delivery</summary>
              <ul className="mt-1 space-y-1">
                {fixed.map((fix, idx) => (
                  <li key={`${fix.location}-${idx}`} className="text-[10px] leading-relaxed">
                    <span className="opacity-60">{fix.label}: </span>
                    <span className="opacity-50">{list(fix.problems).join(' ')}</span>
                    <p className="opacity-40 line-through truncate" title={fix.before}>{fix.before}</p>
                    <p className="opacity-70 truncate" title={fix.after}>{fix.after || '(removed)'}</p>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {removed.length > 0 && (
            <details>
              <summary className="cursor-pointer text-[10px] opacity-60">{removed.length} removed for your exclusions</summary>
              <ul className="mt-1 space-y-0.5">
                {removed.map((item, idx) => (
                  <li key={idx} className="text-[10px] opacity-50" title={item.reason}>
                    {item.label}: &ldquo;{item.text}&rdquo;
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {notes.length > 0 && (
        <div className={`${divider} space-y-1`}>
          {notes.map((note, idx) => (
            <p key={idx} className="text-[10px] text-amber-500">{note}</p>
          ))}
        </div>
      )}
    </div>
  );
};
