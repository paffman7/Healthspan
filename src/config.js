// Owner decisions (HEALTHSPAN_APP_SPEC.md, Part 1).
// Change a setting here to change app behaviour. No scoring numbers live here;
// those are all in scoring-tables.json.

const config = {
  // 1. Pull-ups vs dead hang.
  //    'best_of_both' : score both, keep the better tier and the younger age.
  //    'scorecard'    : pull-ups count if 1+ rep, otherwise the hang.
  pullUpPolicy: 'best_of_both',

  // 2. At-home body composition (tape measure).
  //    tiersKey: which waist-to-height tier list in scoring-tables.json to use.
  //    includeInHealthspanAge: false = no functional age for this station.
  atHomeBodyComp: {
    tiersKey: 'PLACEHOLDER_waistToHeightTiers_lower_is_better',
    calfCapTier: 'fair',
    includeInHealthspanAge: false,
  },

  // 3. InBody ASMI below the sarcopenia line caps the tier at: 'fair' | 'at_risk'.
  asmiCap: 'fair',

  // 4. Untested station: 0 points, left out of the age average (fixed by the scorecard).

  // 5. HubSpot. When enabled, last name + email are asked for before results.
  hubspot: {
    enabled: false,
    endpoint:
      'https://api.hsforms.com/submissions/v3/integration/submit/46210884/85766b0c-d279-4c15-80ce-f14de59057e1',
  },

  // 6. Band descriptions. 'scorecard' = exact scorecard wording,
  //    'softened' = scorecard wording with the overrides below.
  bandWording: 'softened',
  bandDescriptionOverrides: {
    strong:
      'Above average across most components. Functional age indicator typically younger than chronological age.',
  },
};

export default config;
