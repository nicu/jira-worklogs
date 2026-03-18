import { Icon, OAuth } from "@raycast/api";
import { OAuthService } from "@raycast/utils";

export const jiraPkceClient = new OAuth.PKCEClient({
  redirectMethod: OAuth.RedirectMethod.Web,
  providerName: "Jira",
  providerIcon: Icon.Globe,
  providerId: "jira",
  description: "Connect your Jira account",
});

export const jiraOAuth = new OAuthService({
  client: jiraPkceClient,
  clientId: "7W045Xtna8o9jI8XP4lyenW5iN3V61gJ",
  authorizeUrl:
    "https://oauth.raycast.com/v1/authorize/oHQ-Fr_ohs6LyHh-KaOd52Mx_oeZJp0Dipfl7yNR3mYevZBP0ZZwjwCbqiNNARZwY-u8HgCuBArLHdbDJRRmsrVSRVJChJTFeBPIX_E2L7A4ZfoZvQMt_RsLypwGB4ztWwQGlBM00WTXaaBcPHKtZGUtlJkKV3WAoYllf84FtPgCWw8Sk4WPpQPRZqp7wA",
  tokenUrl:
    "https://oauth.raycast.com/v1/token/ZqJkxZcsCzCrRSY76th-ImY5pGH1xfDGRj5VyIElDiUnDEtS1wewoF_kJ5piv5I18-5SdI4duNn03Xni4fkiO4Ow5UuGDEMUCHKc1jOKjCSBIDdkOqpouSQbMoxhWUWh4jdxVbs6rYqyoUyDbgJTWgMErdcu-4-zJlOL6yz9YXQSzDDw2St0LJ0YJFKoYDUK",
  refreshTokenUrl:
    "https://oauth.raycast.com/v1/refresh-token/xL_DRH9LRyYdg-iKm234PMu6qPccIK1vUByL9P9P9SfsfihWTq1IMvv8zayJQCyIgFLpnKdLNBKhjcVjRnVCO0ZVGOd_igQnx32efm5jWT_lqPvyyEp-PSGadoE-nZawxkGCbYHglsglq6i-Lgka0hugFlTvQT-G06hX_DsuqR1XaiB0aV1sMv9yK20VUz1C",

  scope: [
    "read:jira-user",
    "read:jira-work",
    "write:jira-work",
    "offline_access", // request refresh token support where available/required
  ],
});
