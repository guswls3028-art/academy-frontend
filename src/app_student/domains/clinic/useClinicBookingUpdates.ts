import { useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";

import { getApiErrorMessage } from "@/shared/api/errorMessage";
import { studentQueryKeys } from "@student/shared/api/queryKeys";
import { studentClinicQueryKeys } from "./queryKeys";

const BOOKING_ACTION_ERROR_STATUSES = new Set([400, 403, 404, 409, 422]);

export function bookingErrorMessage(error: AxiosError, fallback: string) {
  const status = error.response?.status;
  const body = error.response?.data;
  return status && BOOKING_ACTION_ERROR_STATUSES.has(status) && body && typeof body === "object"
    ? getApiErrorMessage(error, fallback)
    : fallback;
}

export function useClinicBookingUpdates() {
  const queryClient = useQueryClient();
  const refreshLists = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: studentClinicQueryKeys.availableSessions }),
    queryClient.invalidateQueries({ queryKey: studentClinicQueryKeys.bookings }),
    queryClient.invalidateQueries({ queryKey: studentClinicQueryKeys.availabilities }),
  ]);

  const refreshAfterSave = () => {
    void queryClient.invalidateQueries({ queryKey: studentClinicQueryKeys.summary });
    void queryClient.invalidateQueries({ queryKey: studentQueryKeys.clinicIdcard });
    void queryClient.invalidateQueries({ queryKey: studentClinicQueryKeys.notificationCounts });
    return refreshLists();
  };

  const refreshAfterFailure = (error: AxiosError) => {
    const status = error.response?.status;
    if (!status || BOOKING_ACTION_ERROR_STATUSES.has(status) || status >= 500) return refreshLists();
  };

  return { refreshAfterSave, refreshAfterFailure };
}
