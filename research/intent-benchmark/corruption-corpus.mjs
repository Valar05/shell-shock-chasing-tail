// Held-out transcript corruption suite. Not training data. Intentionally probes the limits of fuzzy interpretation.
export const cases=[
 {id:"halt_holt",heard:"driver holt",want:"HALT",risk:"low"},
 {id:"halt_hall",heard:"driver hall",want:"HALT",risk:"low"},
 {id:"turn_typo",heard:"tern thirty degrees left",want:"TURN",risk:"medium"},
 {id:"turn_clean",heard:"turn 30 degrees right",want:"TURN",risk:"medium"},
 {id:"turn_missing_angle",heard:"turn right for the degrees",want:"CLARIFY",risk:"critical"},
 {id:"turn_missing_numeral",heard:"turn right",want:"CLARIFY",risk:"critical"},
 {id:"turn_conflict",heard:"turn left and right 30 degrees",want:"REJECT",risk:"critical"},
 {id:"fire_prohibit",heard:"beta do not fire",want:"HOLD_FIRE",risk:"critical"},
 {id:"fire_dont",heard:"beta don't fire",want:"HOLD_FIRE",risk:"critical"},
 {id:"fire_positive",heard:"beta fire",want:"CLARIFY",risk:"critical"},
 {id:"fire_ambiguous",heard:"beta fine",want:"CLARIFY",risk:"critical"},
 {id:"hold",heard:"driver halt",want:"HALT",risk:"low"},
 {id:"unknown",heard:"what a lovely day",want:"CLARIFY",risk:"low"},
 {id:"tree",heard:"run over that tree",want:"CRUSH_TREE",risk:"medium"},
 {id:"tree_missing",heard:"run over that three",want:"CLARIFY",risk:"critical"},
 {id:"turn_degrees_forty",heard:"turn forty degrees left",want:"TURN",risk:"medium"}
];
