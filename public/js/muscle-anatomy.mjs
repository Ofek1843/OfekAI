const MUSCLE_ANATOMY_VIEW = {
  chest: "front", delts: "front", biceps: "front", core: "front", quads: "front", calves: "front", adductors: "front", abductors: "front",
  back: "back", rear_delts: "back", triceps: "back", traps: "back", glutes: "back", hamstrings: "back"
};

export function muscleAnatomySvg(targetMuscle) {
  const view = MUSCLE_ANATOMY_VIEW[targetMuscle] || "front";
  const regions = {
    front: [
      ["delts", '<ellipse cx="34" cy="52" rx="12" ry="9"/><ellipse cx="86" cy="52" rx="12" ry="9"/>'],
      ["chest", '<rect x="42" y="46" width="36" height="24" rx="8"/>'],
      ["biceps", '<rect x="20" y="64" width="13" height="30" rx="6"/><rect x="87" y="64" width="13" height="30" rx="6"/>'],
      ["core", '<rect x="47" y="74" width="26" height="34" rx="7"/>'],
      ["quads", '<rect x="42" y="118" width="16" height="44" rx="8"/><rect x="62" y="118" width="16" height="44" rx="8"/>'],
      ["adductors", '<rect x="54" y="120" width="6" height="38" rx="3"/><rect x="60" y="120" width="6" height="38" rx="3"/>'],
      ["abductors", '<rect x="38" y="112" width="7" height="34" rx="3"/><rect x="75" y="112" width="7" height="34" rx="3"/>'],
      ["calves", '<rect x="44" y="168" width="13" height="30" rx="6"/><rect x="63" y="168" width="13" height="30" rx="6"/>']
    ],
    back: [
      ["traps", '<path d="M44 40 L76 40 L68 60 L52 60 Z"/>'],
      ["rear_delts", '<ellipse cx="34" cy="54" rx="12" ry="9"/><ellipse cx="86" cy="54" rx="12" ry="9"/>'],
      ["back", '<rect x="42" y="62" width="36" height="42" rx="8"/>'],
      ["triceps", '<rect x="20" y="66" width="13" height="30" rx="6"/><rect x="87" y="66" width="13" height="30" rx="6"/>'],
      ["glutes", '<rect x="42" y="110" width="36" height="22" rx="10"/>'],
      ["hamstrings", '<rect x="42" y="136" width="16" height="40" rx="8"/><rect x="62" y="136" width="16" height="40" rx="8"/>'],
      ["calves", '<rect x="44" y="178" width="13" height="22" rx="6"/><rect x="63" y="178" width="13" height="22" rx="6"/>']
    ]
  }[view];
  const body = '<ellipse class="anatomy-body" cx="60" cy="24" rx="14" ry="16"/><rect class="anatomy-body" x="38" y="42" width="44" height="70" rx="14"/><rect class="anatomy-body" x="18" y="50" width="16" height="52" rx="8"/><rect class="anatomy-body" x="86" y="50" width="16" height="52" rx="8"/><rect class="anatomy-body" x="40" y="110" width="18" height="90" rx="9"/><rect class="anatomy-body" x="62" y="110" width="18" height="90" rx="9"/>';
  const overlays = regions.map(([id, shape]) => `<g class="anatomy-region${id === targetMuscle ? " is-targeted" : ""}">${shape}</g>`).join("");
  return `<svg class="muscle-anatomy-svg" viewBox="0 0 120 210" role="presentation" focusable="false" data-anatomy-view="${view}">${body}${overlays}</svg>`;
}
