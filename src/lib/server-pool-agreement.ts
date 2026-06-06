import PDFDocument from "pdfkit/js/pdfkit.standalone.js";

import { getChampionshipTemplate } from "@/data/templates";
import { getAppNowIso } from "@/lib/app-clock";
import { createAgreementPreviewModel } from "@/lib/pool-agreement";
import { createSupabaseServiceClient } from "@/lib/supabase-server";
import type {
  AuditEvent,
  Championship,
  ChampionshipParticipant,
  PredictionCategory,
  PredictionSubmission,
  PredictionVersion,
} from "@/types/championship";
import type {
  PoolAgreementModel,
  PoolAgreementResult,
} from "@/types/pool-agreement";

type DbChampionship = {
  audit_events?: DbAuditEvent[];
  created_at: string;
  created_by: string | null;
  id: string;
  invite_code: string;
  is_public: boolean;
  lock_date: string;
  name: string;
  participants?: DbParticipant[];
  prediction_submissions?: DbPredictionSubmission[];
  slug: string;
  start_date: string;
  status: Championship["status"] | "draft";
  template_id: string;
};

type DbParticipant = {
  display_name: string;
  handle: string;
  id: string;
  joined_at: string;
  left_at?: string | null;
  locked_status: ChampionshipParticipant["lockedStatus"];
  profile_id: string;
  role: ChampionshipParticipant["role"];
  submission_status: ChampionshipParticipant["submissionStatus"];
};

type DbPredictionSubmission = {
  display_name: string;
  fingerprint?: string | null;
  id: string;
  last_edited_at?: string | null;
  locked_at?: string | null;
  locked_version_id?: string | null;
  participant_id: string;
  prediction_versions?: DbPredictionVersion[];
  profile_id: string;
};

type DbPredictionVersion = {
  created_at: string;
  id: string;
  picks: Record<string, string[]>;
  version_number: number;
};

type DbAuditEvent = {
  actor_name: string;
  created_at: string;
  details: string;
  id: string;
  label: string;
  type: AuditEvent["type"] | string;
};

type DbPoolBet = {
  bet_id: string;
  choices?: string[] | null;
  name: string;
  prompt: string;
  scoring_note: string;
  selection_count: number;
  source: PredictionCategory["source"];
  type: PredictionCategory["type"];
};

export async function getPoolAgreement(
  accessToken: string,
  championshipId: string,
): Promise<PoolAgreementResult> {
  const auth = await authenticate(accessToken);

  if (!auth.ok) {
    return auth;
  }

  const championshipResult = await fetchChampionship(championshipId);

  if (!championshipResult.ok) {
    return championshipResult;
  }

  const championship = championshipResult.championship;
  const isActiveParticipant = championship.participants.some(
    (participant) =>
      participant.profileId === auth.userId && !participant.leftAt,
  );

  if (!isActiveParticipant) {
    return {
      ok: false,
      message: "Join this pool before viewing the agreement.",
      status: 403,
    };
  }

  return {
    ok: true,
    agreement: createAgreementPreviewModel({
      championship,
      generatedAt: getAppNowIso(),
      tournamentName: getChampionshipTemplate(championship.tournamentId).name,
    }),
  };
}

export async function createPoolAgreementPdf(agreement: PoolAgreementModel) {
  const document = new PDFDocument({
    autoFirstPage: false,
    bufferPages: true,
    margins: { bottom: 34, left: 48, right: 48, top: 44 },
    size: "A4",
  });
  const chunks: Buffer[] = [];

  document.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });

  drawAgreementPage(document, agreement);
  drawRecordedPicksPage(document, agreement);
  document.end();

  return done;
}

async function authenticate(
  accessToken: string,
): Promise<
  | { ok: true; userId: string }
  | { ok: false; message: string; status: number }
> {
  if (!accessToken) {
    return { ok: false, message: "Login required.", status: 401 };
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user) {
    return { ok: false, message: "Login required.", status: 401 };
  }

  return { ok: true, userId: data.user.id };
}

async function fetchChampionship(championshipId: string) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("championships")
    .select(
      "*, participants(*), prediction_submissions(*, prediction_versions!prediction_versions_submission_id_fkey(*)), audit_events(*)",
    )
    .eq("id", championshipId)
    .maybeSingle();

  if (error) {
    return { ok: false as const, message: error.message, status: 400 };
  }

  if (!data) {
    return { ok: false as const, message: "Pool not found.", status: 404 };
  }

  const { data: betRows, error: betError } = await supabase
    .from("pool_bets")
    .select("bet_id, name, type, prompt, selection_count, scoring_note, choices, source")
    .eq("championship_id", championshipId)
    .order("sort_order", { ascending: true });

  if (betError) {
    return { ok: false as const, message: betError.message, status: 400 };
  }

  return {
    ok: true as const,
    championship: mapChampionshipFromDb(
      data as DbChampionship,
      (betRows ?? []) as DbPoolBet[],
    ),
  };
}

function mapChampionshipFromDb(
  row: DbChampionship,
  betRows: DbPoolBet[],
): Championship {
  const tournament = getChampionshipTemplate(row.template_id);

  return {
    auditLog: (row.audit_events ?? []).map(mapAuditEventFromDb),
    bets: betRows.length ? betRows.map(mapBetFromDb) : tournament.defaultBets,
    createdAt: row.created_at,
    creatorProfileId: row.created_by ?? "system",
    id: row.id,
    inviteCode: row.invite_code,
    isPublic: row.is_public,
    lockDate: row.lock_date,
    name: row.name,
    participants: (row.participants ?? []).map(mapParticipantFromDb),
    predictions: (row.prediction_submissions ?? []).map(mapSubmissionFromDb),
    slug: row.slug,
    startDate: row.start_date,
    status: row.status === "draft" ? "open" : row.status,
    templateId: row.template_id,
    tournamentId: row.template_id,
  };
}

function mapParticipantFromDb(row: DbParticipant): ChampionshipParticipant {
  return {
    displayName: row.display_name,
    handle: row.handle,
    id: row.id,
    joinedAt: row.joined_at,
    leftAt: row.left_at ?? undefined,
    lockedStatus: row.locked_status,
    profileId: row.profile_id,
    role: row.role,
    submissionStatus: row.submission_status,
  };
}

function mapSubmissionFromDb(row: DbPredictionSubmission): PredictionSubmission {
  return {
    displayName: row.display_name,
    fingerprint: row.fingerprint ?? undefined,
    id: row.id,
    lastEditedAt: row.last_edited_at ?? undefined,
    lockedAt: row.locked_at ?? undefined,
    lockedVersionId: row.locked_version_id ?? undefined,
    participantId: row.participant_id,
    profileId: row.profile_id,
    versions: (row.prediction_versions ?? [])
      .map(mapVersionFromDb)
      .sort((a, b) => a.versionNumber - b.versionNumber),
  };
}

function mapVersionFromDb(row: DbPredictionVersion): PredictionVersion {
  return {
    createdAt: row.created_at,
    id: row.id,
    picks: row.picks,
    versionNumber: row.version_number,
  };
}

function mapBetFromDb(row: DbPoolBet): PredictionCategory {
  return {
    choices: row.choices ?? undefined,
    id: row.bet_id,
    name: row.name,
    prompt: row.prompt,
    scoringNote: row.scoring_note,
    selectionCount: row.selection_count,
    source: row.source,
    type: row.type,
  };
}

function mapAuditEventFromDb(row: DbAuditEvent): AuditEvent {
  return {
    actorName: row.actor_name,
    details: row.details,
    id: row.id,
    label: row.label,
    timestamp: row.created_at,
    type: normalizeAuditType(row.type),
  };
}

function normalizeAuditType(type: string): AuditEvent["type"] {
  if (
    type === "pool_created" ||
    type === "invite_created" ||
    type === "participant_joined" ||
    type === "participant_left" ||
    type === "bet_added" ||
    type === "bet_removed" ||
    type === "prediction_field_changed" ||
    type === "prediction_draft_saved" ||
    type === "prediction_locked" ||
    type === "prediction_unlocked"
  ) {
    return type;
  }

  return "pool_created";
}

function drawAgreementPage(
  document: PDFKit.PDFDocument,
  agreement: PoolAgreementModel,
) {
  addPage(document);
  drawTitle(document, agreement);
  let y = 226;

  y = paragraph(
    document,
    "This Agreement is entered into by and between the undersigned Participants, each possessing varying degrees of sports knowledge, confidence, and emotional risk.",
    70,
    y,
    455,
  );
  y += 8;
  textLine(document, "Pool:", agreement.poolName, 70, y);
  y += 18;
  textLine(document, "Tournament:", agreement.tournamentName, 70, y);
  y += 18;
  textLine(document, "Invite Code:", agreement.inviteCode, 70, y);
  y += 18;
  textLine(document, "Agreement ID:", agreement.agreementId, 70, y);
  y += 18;
  textLine(document, "Lock Date:", `${formatDate(agreement.lockDate)} IST`, 70, y);
  drawSeal(document, 492, 268, agreement.isSealed ? "SEALED" : "DRAFT");
  y += 34;

  y = section(document, "1. PARTIES INVOLVED", y);
  for (const [index, participant] of agreement.participants.entries()) {
    rowLine(document, y, [
      `Party ${index + 1}`,
      participant.displayName,
      `@${participant.handle}`,
      participant.status === "active" ? participant.role : "left",
    ]);
    y += 28;
  }
  y += 8;

  for (const [title, body] of friendlyClauses.slice(0, 5)) {
    y = clause(document, title, body, y);
  }

  y = section(document, "6. HEREBY AGREED", y);
  y = paragraph(
    document,
    "The Participants hereby agree that the Pool, the picks, the Lock Date, and the Audit Log together form the official friendship record. Each Participant further agrees that after sealing, selective memory shall be admired for creativity but rejected as evidence.",
    86,
    y,
    430,
    9.6,
    2,
  );
  y += 10;

  y = section(document, "7. PARTICIPANT SIGNATURES", y);
  const signatureY = y;
  for (const [index, participant] of agreement.participants.slice(0, 4).entries()) {
    const x = 78 + (index % 2) * 230;
    const boxY = signatureY + Math.floor(index / 2) * 50;
    signatureBlock(document, x, boxY, participant.displayName, `@${participant.handle}`, agreement.isSealed ? "Locked" : "Waiting");
  }

  footer(document, agreement, 1);
}

function drawRecordedPicksPage(
  document: PDFKit.PDFDocument,
  agreement: PoolAgreementModel,
) {
  addPage(document);
  document
    .font("Times-Bold")
    .fontSize(27)
    .fillColor("#17120d")
    .text("RECORDED PICKS SCHEDULE", 0, 105, { align: "center" });
  document
    .font("Times-Roman")
    .fontSize(10)
    .fillColor("#3f3429")
    .text(
      agreement.isSealed
        ? "The following selections were recorded from sealed pool data."
        : "Draft preview: selections stay hidden until this agreement is sealed.",
      0,
      132,
      { align: "center" },
    );

  let y = 172;
  y = section(document, "7. RECORDED PICKS PER PARTICIPANT", y);

  if (!agreement.isSealed) {
    y = paragraph(
      document,
      "Picks are hidden in draft agreements. The final sealed agreement will show every active participant's selected option for each bet after the pool lock deadline passes.",
      58,
      y,
      480,
    );
  } else {
    tableHeader(document, y);
    y += 28;
    for (const bet of agreement.bets) {
      const rows = agreement.picks.filter((pick) => pick.betId === bet.id);

      for (const [rowIndex, row] of rows.entries()) {
        if (y > 715) {
          footer(document, agreement, document.bufferedPageRange().count + 1);
          addPage(document);
          y = 96;
          tableHeader(document, y);
          y += 28;
        }

        document
          .strokeColor("#8f806f")
          .lineWidth(0.5)
          .moveTo(58, y - 4)
          .lineTo(537, y - 4)
          .stroke();
        fitText(document, rowIndex === 0 ? bet.name : "", 68, y + 5, 124, 8.8, "Times-Bold");
        fitText(document, row.participantName, 205, y + 5, 118, 8.8);
        fitText(
          document,
          row.selectedOptions.length
            ? row.selectedOptions.join(", ")
            : "No saved pick",
          342,
          y + 5,
          190,
          8.8,
        );
        y += 22;
      }
      y += 6;
    }
  }

  y += 16;
  y = section(document, "8. AUDIT SUMMARY", y);
  const summary = agreement.auditSummary;
  const auditRows = [
    ["Pool created", formatDateTime(summary.poolCreatedAt)],
    ["Participants joined", String(summary.participantsJoined)],
    ["Participants left", String(summary.participantsLeft)],
    ["Bets included", String(agreement.bets.length)],
    ["Pick versions saved", String(summary.pickVersionsSaved)],
    ["Picks locked", String(summary.predictionLocks)],
    ["Picks reopened", String(summary.predictionReopens)],
    ["Bet changes", String(summary.betChanges)],
  ];

  for (const [index, row] of auditRows.entries()) {
    const x = 58 + (index % 2) * 238;
    const rowY = y + Math.floor(index / 2) * 26;
    document.rect(x, rowY, 218, 20).fill("#dfd0b6");
    document.fillColor("#17120d").font("Times-Bold").fontSize(8.5).text(row[0], x + 8, rowY + 7);
    fitText(document, row[1], x + 112, rowY + 7, 96, 8.2);
  }

  drawSeal(document, 492, 732, agreement.isSealed ? "SEALED" : "DRAFT");
  document
    .font("Times-Roman")
    .fontSize(8.3)
    .fillColor("#3f3429")
    .text(`Fingerprint: ${agreement.fingerprint}`, 58, 720, { width: 365 });
  document
    .text(`Generated: ${formatDateTime(agreement.generatedAt)} IST`, 58, 735, {
      width: 365,
    });

  footer(document, agreement, document.bufferedPageRange().count);
}

const friendlyClauses = [
  [
    "1. PURPOSE",
    "To record everyone’s picks before hindsight enters the chat, before confidence becomes memory, and before anyone claims they were obviously thinking the same thing.",
  ],
  [
    "2. LOCK DATE",
    "After the Lock Date, no picks may be edited, reopened, rescued, upgraded, spiritually reinterpreted, or explained as what I meant was.",
  ],
  [
    "3. AUDIT LOG",
    "The Audit Log shall serve as the official memory of the Pool and shall be trusted more than any participant’s recollection after the first major upset.",
  ],
  [
    "4. BRAGGING RIGHTS",
    "The winner may brag responsibly. Excessive bragging may be muted by the group, but the result itself may not be disputed.",
  ],
  [
    "5. VIBES CLAUSE",
    "If a Participant wins by vibes alone, the group shall respect the vibes and pretend this was analysis.",
  ],
] as const;

function addPage(document: PDFKit.PDFDocument) {
  document.addPage({ margin: 0, size: "A4" });
  document.rect(0, 0, 595.28, 841.89).fill("#efe3ce");
  document
    .fillColor("#7a542f")
    .opacity(0.08)
    .rect(0, 0, 28, 841.89)
    .rect(567, 0, 28, 841.89)
    .rect(0, 0, 595.28, 28)
    .rect(0, 814, 595.28, 28)
    .fill()
    .opacity(1);
  document.roundedRect(30, 34, 535, 774, 18).strokeColor("#6e5842").lineWidth(1.4).stroke();
  document.roundedRect(39, 43, 517, 756, 12).strokeColor("#6e5842").lineWidth(0.7).stroke();
  document.moveTo(150, 55).lineTo(445, 55).moveTo(150, 786).lineTo(445, 786).stroke();
}

function drawTitle(document: PDFKit.PDFDocument, agreement: PoolAgreementModel) {
  document.font("Times-Bold").fillColor("#17120d");
  document.fontSize(22).text("THE OFFICIAL", 0, 106, { align: "center" });
  document.fontSize(32).text("FAN PICKS AGREEMENT", 0, 144, { align: "center" });
  document
    .fontSize(9)
    .fillColor("#6f4d2f")
    .text(
      `${agreement.agreementId} · ${agreement.inviteCode} · ${agreement.isSealed ? "SEALED AFTER LOCK DATE" : "DRAFT PREVIEW"}`,
      0,
      180,
      { align: "center" },
    );
}

function section(document: PDFKit.PDFDocument, title: string, y: number) {
  document.font("Times-Bold").fontSize(12).fillColor("#17120d").text(title, 70, y);
  return y + 20;
}

function clause(document: PDFKit.PDFDocument, title: string, body: string, y: number) {
  document.font("Times-Bold").fontSize(12).fillColor("#17120d").text(title, 70, y);
  return paragraph(document, body, 86, y + 15, 450, 10, 13) + 9;
}

function paragraph(
  document: PDFKit.PDFDocument,
  value: string,
  x: number,
  y: number,
  width: number,
  size = 11,
  lineGap = 3,
) {
  document
    .font("Times-Roman")
    .fontSize(size)
    .fillColor("#17120d")
    .text(value, x, y, { lineGap, width });
  return document.y;
}

function textLine(
  document: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  y: number,
) {
  document.font("Times-Bold").fontSize(11).fillColor("#17120d").text(label, x, y);
  fitText(document, value, x + 84, y, 300, 11, "Times-Roman");
}

function rowLine(document: PDFKit.PDFDocument, y: number, cells: string[]) {
  document.strokeColor("#6e5842").lineWidth(0.5).moveTo(86, y + 16).lineTo(512, y + 16).stroke();
  fitText(document, cells[0], 88, y + 3, 58, 10, "Times-Bold");
  fitText(document, cells[1], 160, y + 3, 130, 10.5, "Times-Bold");
  fitText(document, cells[2], 306, y + 3, 116, 9, "Times-Roman", "#3f3429");
  fitText(document, cells[3], 440, y + 3, 72, 9, "Times-Italic", "#3f3429");
}

function signatureBlock(
  document: PDFKit.PDFDocument,
  x: number,
  y: number,
  name: string,
  handle: string,
  status: string,
) {
  document.roundedRect(x, y, 198, 42, 5).strokeColor("#6e5842").lineWidth(0.8).stroke();
  fitText(document, name, x + 12, y + 11, 112, 15, "Times-Italic");
  fitText(document, handle, x + 12, y + 27, 100, 8.5, "Times-Roman", "#3f3429");
  fitText(document, status, x + 148, y + 27, 44, 8.5, "Times-Bold", "#a36d1c");
}

function tableHeader(document: PDFKit.PDFDocument, y: number) {
  document.rect(58, y, 479, 24).fill("#dfd0b6");
  document.font("Times-Bold").fontSize(9).fillColor("#17120d");
  document.text("Bet", 68, y + 8);
  document.text("Participant", 205, y + 8);
  document.text("Selected Option(s)", 342, y + 8);
}

function drawSeal(document: PDFKit.PDFDocument, x: number, y: number, label: string) {
  document.circle(x, y, 34).strokeColor("#a36d1c").lineWidth(2).stroke();
  document.circle(x, y, 27).strokeColor("#a36d1c").lineWidth(0.8).stroke();
  document.font("Times-Bold").fontSize(10).fillColor("#a36d1c").text(label, x - 26, y - 2, { align: "center", width: 52 });
  document.fontSize(7).text("FAN PICKS", x - 26, y + 13, { align: "center", width: 52 });
}

function footer(document: PDFKit.PDFDocument, agreement: PoolAgreementModel, pageNumber: number) {
  document
    .font("Times-Roman")
    .fontSize(7.5)
    .fillColor("#3f3429")
    .text(
      `Fan Picks Agreement · ${agreement.inviteCode} · ${agreement.agreementId} · Friendly non-legal receipt document`,
      48,
      818,
      { width: 420 },
    );
  document.text(`Page ${pageNumber}`, 520, 818);
}

function fitText(
  document: PDFKit.PDFDocument,
  value: string,
  x: number,
  y: number,
  width: number,
  size = 10,
  font = "Times-Roman",
  color = "#17120d",
) {
  let nextValue = value;

  document.font(font).fontSize(size);

  while (document.widthOfString(nextValue) > width && nextValue.length > 4) {
    nextValue = `${nextValue.slice(0, -4)}...`;
  }

  document.fillColor(color).text(nextValue, x, y, {
    lineBreak: false,
  });
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(new Date(`${value}T00:00:00+05:30`));
}

function formatDateTime(value: string) {
  return `${new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value))}`;
}
