// Plate numbers get typed inconsistently across the app — an owner might
// register as "JCG-5463", while an enforcer manually filing a report might
// type "JCG 5463" or "JCG5463" for the exact same plate. A plain exact
// string match (even after .toUpperCase()) treats those as three different
// plates, which silently breaks the Violation -> Owner link (the violation
// gets saved with owner: null and never shows up on the owner's side).
//
// These helpers strip everything down to bare alphanumeric characters for
// comparison, and build a MongoDB regex that matches a plate regardless of
// which separators (if any) were used, without changing how the plate is
// actually stored/displayed.

function normalizePlate(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Builds a case-insensitive regex that matches the given plate number
// regardless of spaces/dashes/etc. between characters in the stored value.
// e.g. "JCG5463" -> matches "JCG5463", "JCG-5463", "JCG 5463", "jcg 5463"
function buildFlexiblePlateRegex(value) {
  const chars = normalizePlate(value).split("");
  if (!chars.length) return null;
  const pattern = "^" + chars.map(escapeRegex).join("[^A-Za-z0-9]*") + "$";
  return new RegExp(pattern, "i");
}

module.exports = { normalizePlate, buildFlexiblePlateRegex };
