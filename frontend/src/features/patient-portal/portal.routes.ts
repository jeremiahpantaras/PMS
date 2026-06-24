export const PORTAL_ROUTES = {
  home:    (slug: string) => `/book/${slug}`,
  success: (slug: string) => `/book/${slug}/success`,
  legacy:  (token: string) => `/portal/${token}`,
  legacySuccess: (token: string) => `/portal/${token}/success`,
} as const;