/**
 * Centralized user-facing strings (§16 of ARCHITECTURE.md — i18n readiness).
 * All copy used in the UI should live here, so adopting `next-intl` later
 * requires only replacing this module with useTranslations() calls, not
 * hunting through component files for hardcoded strings.
 *
 * Organized by feature/section for ease of discovery and maintenance.
 */

// ============================================================================
// Auth & Login
// ============================================================================

export const AUTH_COPY = {
  LOGIN_PAGE_TITLE: 'DISPATCH',
  LOGIN_FORM_EMAIL_LABEL: 'Email',
  LOGIN_FORM_PASSWORD_LABEL: 'Password',
  LOGIN_FORM_SUBMIT: 'LOG IN',
  LOGIN_FORM_ERROR: 'Invalid email or password',
  LOGIN_FORM_ERROR_GENERIC: 'Something went wrong. Please try again.',
  LOGOUT_BUTTON: 'LOG OUT',
} as const;

// ============================================================================
// Composer / Message Creation
// ============================================================================

export const COMPOSER_COPY = {
  MESSAGE_LABEL: 'Message',
  MESSAGE_PLACEHOLDER: 'Share your thoughts...',
  TAG_LABEL: 'Tag',
  POST_BUTTON: 'POST',
  POST_BUTTON_PENDING: 'POSTING…',
  CHAR_COUNT_LABEL: '{current}/240',
  ERROR_COULD_NOT_POST: "Couldn't post — please check your connection and try again.",
  ERROR_SERVER_BUSY: "Couldn't post — the server is busy. Try again?",
  SUCCESS_HIDDEN_BY_FILTERS: 'Posted — hidden by current filters · Clear filters to see it',
} as const;

// ============================================================================
// Message Card / Actions
// ============================================================================

export const MESSAGE_CARD_COPY = {
  EDIT_BUTTON: 'EDIT',
  DELETE_BUTTON: 'DELETE',
  DELETE_CONFIRM_BUTTON: 'SURE?',
  ERROR_CAN_ONLY_EDIT_OWN: 'You can only edit your own messages',
  ERROR_CAN_ONLY_DELETE_OWN: 'You can only delete your own messages',
  ERROR_COULD_NOT_SAVE: "Couldn't save — please try again.",
  ERROR_COULD_NOT_DELETE: "Couldn't delete — please try again.",
  TIMESTAMP_TITLE_PREFIX: 'Created',
} as const;

// ============================================================================
// Filters
// ============================================================================

export const FILTERS_COPY = {
  FILTERS_TITLE: 'FILTERS',
  TAG_SECTION_LABEL: 'Tag',
  USER_SECTION_LABEL: 'User',
  DATE_SECTION_LABEL: 'Date',
  CLEAR_BUTTON: 'clear',
  OPEN_ALL_FILTERS_BUTTON: 'Open all filters',
  FILTER_SHEET_TITLE: 'Filters',
  DATE_FROM_LABEL: 'From',
  DATE_TO_LABEL: 'To',
} as const;

// ============================================================================
// Feed States
// ============================================================================

export const FEED_COPY = {
  NO_MESSAGES_TITLE: 'No messages here yet',
  NO_MESSAGES_DESCRIPTION: 'Be the first to post!',
  NO_MESSAGES_WITH_FILTERS_TITLE: 'No messages match your filters',
  NO_MESSAGES_WITH_FILTERS_ACTION: 'Clear filters',
  LOAD_MORE_BUTTON: 'LOAD MORE ↓',
  ERROR_TITLE: 'Something broke',
  ERROR_RETRY: 'RETRY',
  FEED_LABEL: 'Message feed',
  FETCHING_INDICATOR: 'Loading messages…',
} as const;

// ============================================================================
// Toaster / Notifications
// ============================================================================

export const TOASTER_COPY = {
  NOTIFICATIONS_REGION_LABEL: 'Notifications',
  DISMISS_BUTTON: '✕',
  DISMISS_BUTTON_LABEL: 'Dismiss notification',
} as const;

// ============================================================================
// Navigation & Layout
// ============================================================================

export const NAV_COPY = {
  AVATAR_LABEL_PREFIX: 'Avatar for',
} as const;

// ============================================================================
// Accessibility
// ============================================================================

export const A11Y_COPY = {
  FOCUS_VISIBLE_LABEL: 'Focus indicator',
  REDUCED_MOTION_PREFERENCE: 'Respects prefers-reduced-motion',
} as const;
