import React from "react";
import type { OptimizationResult } from "../services/geminiService";
import { ATS_BODY_PT, ATS_LINE_HEIGHT, exportBlocks } from "../lib/atsDocument";
import type { AtsFont } from "../lib/atsDocument";

export function AtsResumePreview({ resume, font }: { resume: OptimizationResult; font: AtsFont }) {
  return <article className="resume-page ats-safe-resume" style={{ fontFamily: font, fontSize: `${ATS_BODY_PT}pt`, lineHeight: ATS_LINE_HEIGHT, color: "#000", background: "#fff", padding: "16mm", width: "210mm" }}>
    {exportBlocks(resume).map((block, index) => {
      const style = { fontFamily: font, letterSpacing: "normal", lineHeight: ATS_LINE_HEIGHT, textAlign: "left" as const, margin: "0 0 6pt", overflowWrap: "anywhere" as const, breakInside: "avoid" as const };
      if (block.kind === "name") return <h1 key={index} style={{ ...style, fontSize: "18pt", fontWeight: 700 }}>{block.text}</h1>;
      if (block.kind === "heading") return <h2 key={index} style={{ ...style, fontSize: "12pt", fontWeight: 700, marginTop: "12pt", breakAfter: "avoid" }}>{block.text}</h2>;
      return <p key={index} style={{ ...style, fontSize: `${ATS_BODY_PT}pt` }}>{block.kind === "bullet" ? `• ${block.text}` : block.text}</p>;
    })}
  </article>;
}
