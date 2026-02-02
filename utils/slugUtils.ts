/**
 * Utility functions for consistent slug handling
 */

/**
 * Normalizes Norwegian and accented characters to ASCII equivalents
 * Examples:
 * - æ → ae, ø → o, å → a
 * - é → e, ü → u
 */
const normalizeCharacters = (input: string): string => {
  return input
    // Norwegian specific
    .replace(/æ/gi, 'ae')
    .replace(/ø/gi, 'o')
    .replace(/å/gi, 'a')
    // General unicode normalization (é → e, ü → u, etc.)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

/**
 * Converts a room name to a normalized URL slug (always lowercase)
 * Example: "Meeting Room B" -> "meeting-room-b"
 * Sanitizes special characters to prevent URL breaking
 */
export const roomNameToSlug = (roomName: string): string => {
  return normalizeCharacters(roomName)
    .trim()
    // Remove dangerous characters
    .replace(/[<>"'&\/\\]/g, '')
    // Replace other special chars with hyphens
    .replace(/[^a-zA-Z0-9\s-]/g, '-')
    // Replace spaces with hyphens
    .replace(/\s+/g, '-')
    // Replace multiple hyphens with single hyphen
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
};

/**
 * Converts a URL slug back to a room name format
 * Example: "meeting-room-b" -> "Meeting Room B"
 */
export const slugToRoomName = (slug: string): string => {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Normalizes company name to slug format (consistent with existing logic)
 */
export const companyNameToSlug = (companyName: string): string => {
  return normalizeCharacters(companyName)
    .trim()
    .replace(/[<>"'&\/\\]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
};

/**
 * Converts company slug back to proper format
 */
export const slugToCompanyName = (slug: string): string => {
  return slug
    .split('-')
    .map(word =>
      word.toUpperCase() === 'AS'
        ? 'AS'
        : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(' ');
};

/**
 * Formats room name for display with proper capitalization
 */
export const formatRoomNameForDisplay = (roomName: string): string => {
  if (!roomName) return '';

  if (roomName.includes('-')) {
    return slugToRoomName(roomName);
  }

  return roomName
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Sanitizes and validates room name input
 */
export const sanitizeRoomName = (roomName: string): string => {
  if (!roomName) return '';

  return normalizeCharacters(roomName)
    .trim()
    .replace(/[<>"'&\/\\]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Formats room name for storage in database with proper title case
 */
export const formatRoomNameForStorage = (roomName: string): string => {
  if (!roomName) return '';

  const sanitized = sanitizeRoomName(roomName);

  return sanitized
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};
