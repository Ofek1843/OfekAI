"use strict";

// Stable, public sample data for crawler-readable feature pages. These are the
// existing editorial previews, independent of homepage screenshot presentation.
const workout = '<span class="preview-profile">Build muscle · 4 days · Gym</span><div class="preview-split"><b>Upper / Lower</b><small>8-week plan · Upper A</small></div><div class="preview-exercise"><img width="95" height="80" decoding="async" src="/images/exercises/bench-press.webp" alt="" loading="lazy"><span><b>Bench press</b><small>3 sets · 8–12 reps<br>Rest 120 sec · RIR 2</small></span></div><div class="preview-exercise"><img width="95" height="80" decoding="async" src="/images/exercises/seated-cable-row.webp" alt="" loading="lazy"><span><b>Seated cable row</b><small>3 sets · 8–12 reps<br>Rest 90 sec · RIR 2</small></span></div><div class="preview-volume"><span>Chest · weekly sets</span><b>12 <small>Within target</small></b><i></i></div>';
const diary = '<div class="preview-diary"><div class="preview-calorie-ring"><div><b>1,650</b><small>kcal eaten</small></div></div><div class="preview-diary-stats"><span><i class="eaten-dot"></i>Eaten <b>1,650 kcal</b></span><span><i class="remaining-dot"></i>Remaining <b>750 kcal</b></span><span class="preview-protein">Protein <b>112 / 150 g</b><i></i></span></div></div><div class="preview-log-entry">“Chicken sandwich and an apple”<small>Review portions · edit estimates · track your day</small></div>';

module.exports = Object.freeze({ workout, diary });
