/**
 * Business logic helpers for computing resource state and conflict detection.
 * DB-backed versions use bookingsDB instead of in-memory arrays.
 */

const { BOOKING_STATUS, RESOURCE_STATUS } = require('../data/store');
const { bookingsDB } = require('../db/database');

/**
 * Return all active bookings that overlap with [startTime, endTime] for a given resource.
 * (Legacy helper kept for backward compatibility with in-memory usage.)
 */
function getOverlappingBookings(bookings, resourceId, startTime, endTime, excludeId = null) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  return bookings.filter((b) => {
    if (b.resourceId !== resourceId) return false;
    if (b.status !== BOOKING_STATUS.ACTIVE) return false;
    if (excludeId && b.id === excludeId) return false;
    const bStart = new Date(b.startTime);
    const bEnd = new Date(b.endTime);
    return !(bEnd <= start || bStart >= end);
  });
}

/**
 * Calculate how many units are already booked for a resource in a time window.
 * (Legacy helper kept for backward compatibility with in-memory usage.)
 */
function getBookedQuantity(bookings, resourceId, startTime, endTime, excludeId = null) {
  const overlapping = getOverlappingBookings(bookings, resourceId, startTime, endTime, excludeId);
  return overlapping.reduce((sum, b) => sum + (b.quantity || 0), 0);
}

/**
 * DB-backed version: get booked quantity from SQLite.
 */
function getBookedQuantityDB(resourceId, startTime, endTime, excludeId = null) {
  const overlapping = bookingsDB.getOverlapping(resourceId, startTime, endTime, excludeId);
  return overlapping.reduce((sum, b) => sum + (b.quantity || 0), 0);
}

/**
 * Check whether a new booking request is valid (no conflict).
 * Returns { ok: true } or { ok: false, reason: string }
 */
function checkConflict(resource, bookings, startTime, endTime, requestedQuantity, excludeId = null) {
  if (new Date(startTime) >= new Date(endTime)) {
    return { ok: false, reason: 'Start time must be before end time.' };
  }

  const bookedQty = getBookedQuantity(bookings, resource.id, startTime, endTime, excludeId);
  const available = resource.totalQuantity - bookedQty;

  if (resource.type === 'single') {
    if (available < 1) {
      return { ok: false, reason: `${resource.name} is already booked during that time slot.` };
    }
  } else {
    if (available < requestedQuantity) {
      return {
        ok: false,
        reason: `Only ${available} of ${resource.totalQuantity} units are available during that time slot.`,
      };
    }
  }

  return { ok: true };
}

/**
 * DB-backed conflict check.
 */
function checkConflictDB(resource, startTime, endTime, requestedQuantity, excludeId = null) {
  if (new Date(startTime) >= new Date(endTime)) {
    return { ok: false, reason: 'Start time must be before end time.' };
  }

  const bookedQty = getBookedQuantityDB(resource.id, startTime, endTime, excludeId);
  const available = resource.totalQuantity - bookedQty;

  if (resource.type === 'single') {
    if (available < 1) {
      return { ok: false, reason: `${resource.name} is already booked during that time slot.` };
    }
  } else {
    if (available < requestedQuantity) {
      return {
        ok: false,
        reason: `Only ${available} of ${resource.totalQuantity} units are available during that time slot.`,
      };
    }
  }

  return { ok: true };
}

/**
 * Derive the current status of a resource based on active bookings right now.
 */
function getResourceStatus(resource, bookings) {
  const now = new Date().toISOString();
  const booked = getBookedQuantity(bookings, resource.id, now, now);

  if (booked === 0) return RESOURCE_STATUS.AVAILABLE;
  if (booked >= resource.totalQuantity) return RESOURCE_STATUS.FULL;
  return RESOURCE_STATUS.PARTIAL;
}

/**
 * DB-backed resource status.
 */
function getResourceStatusDB(resource) {
  const now = new Date().toISOString();
  const booked = getBookedQuantityDB(resource.id, now, now);

  if (booked === 0) return RESOURCE_STATUS.AVAILABLE;
  if (booked >= resource.totalQuantity) return RESOURCE_STATUS.FULL;
  return RESOURCE_STATUS.PARTIAL;
}

/**
 * Check whether a booking is overdue (active but past its end time).
 */
function isBookingOverdue(booking) {
  if (booking.status !== BOOKING_STATUS.ACTIVE) return false;
  return new Date(booking.endTime) < new Date();
}

/**
 * Enrich a resource object with derived fields: status, currentBooked, availableNow, overdueBookings.
 * (Legacy helper using in-memory bookings array.)
 */
function enrichResource(resource, bookings) {
  const now = new Date().toISOString();
  const currentBooked = getBookedQuantity(bookings, resource.id, now, now);
  const status = getResourceStatus(resource, bookings);
  const overdueBookings = bookings.filter(
    (b) => b.resourceId === resource.id && isBookingOverdue(b)
  ).length;
  return {
    ...resource,
    currentBooked,
    availableNow: resource.totalQuantity - currentBooked,
    status,
    overdueBookings,
  };
}

/**
 * DB-backed enrichResource: reads live data from SQLite.
 */
function enrichResourceDB(resource) {
  const now = new Date().toISOString();
  const currentBooked = getBookedQuantityDB(resource.id, now, now);
  const status = getResourceStatusDB(resource);
  const overdueBookings = bookingsDB.getAll({ resourceId: resource.id, status: 'active' })
    .filter((b) => isBookingOverdue(b)).length;
  return {
    ...resource,
    currentBooked,
    availableNow: resource.totalQuantity - currentBooked,
    status,
    overdueBookings,
  };
}

module.exports = {
  getOverlappingBookings,
  getBookedQuantity,
  getBookedQuantityDB,
  checkConflict,
  checkConflictDB,
  getResourceStatus,
  getResourceStatusDB,
  enrichResource,
  enrichResourceDB,
  isBookingOverdue,
};
