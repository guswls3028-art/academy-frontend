import { useEffect, useRef, useState } from "react";
import { App } from "antd";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ClinicSettings } from "../api/clinicSettings.api";
import { updateClinicSettings } from "../api/clinicSettings.api";
import { apiErrorMessage } from "../components/clinicCreatePanel.utils";
import { clinicQueryKeys } from "../queryKeys";

type BookingPolicySource = {
  allow_time_preference?: boolean;
  allow_multi_slot_booking?: boolean;
  booking_mode?: "fixed_slot" | "time_range";
  booking_interval_minutes?: 30 | 60;
  booking_max_stay_minutes?: number;
};

export function useClinicBookingPolicy({
  sourceSession,
  settings,
}: {
  sourceSession?: BookingPolicySource;
  settings?: ClinicSettings;
}) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [allowTimePreference, setAllowTimePreference] = useState(
    sourceSession?.allow_time_preference ?? false,
  );
  const [allowMultiSlotBooking, setAllowMultiSlotBookingState] = useState(
    sourceSession?.allow_multi_slot_booking ?? false,
  );
  const [bookingMode, setBookingMode] = useState<"fixed_slot" | "time_range">(
    sourceSession?.booking_mode ?? "fixed_slot",
  );
  const [bookingIntervalMinutes, setBookingIntervalMinutes] = useState<30 | 60>(
    sourceSession?.booking_interval_minutes ?? 60,
  );
  const [bookingMaxStayMinutes, setBookingMaxStayMinutes] = useState(
    sourceSession?.booking_max_stay_minutes ?? 240,
  );
  const multiSlotTouchedRef = useRef(false);

  useEffect(() => {
    if (sourceSession || multiSlotTouchedRef.current || !settings) return;
    setAllowMultiSlotBookingState(settings.multi_slot_booking_default === true);
    setBookingMode(settings.booking_mode);
    setBookingIntervalMinutes(settings.booking_interval_minutes);
    setBookingMaxStayMinutes(settings.booking_max_stay_minutes);
  }, [settings, sourceSession]);

  useEffect(() => {
    if (bookingMode === "time_range") setAllowMultiSlotBookingState(false);
  }, [bookingMode]);

  const saveDefaultPolicyMutation = useMutation({
    mutationFn: () => updateClinicSettings(undefined, undefined, undefined, {
      booking_mode: bookingMode,
      booking_interval_minutes: bookingIntervalMinutes,
      booking_max_stay_minutes: bookingMaxStayMinutes,
    }),
    onSuccess: (nextSettings) => {
      queryClient.setQueryData(clinicQueryKeys.settings, nextSettings);
      message.success("새 일정 기본 예약 정책을 저장했습니다.");
    },
    onError: (error: unknown) => {
      message.error(apiErrorMessage(error, "기본 예약 정책을 저장하지 못했습니다."));
    },
  });

  return {
    allowTimePreference,
    setAllowTimePreference,
    allowMultiSlotBooking,
    setAllowMultiSlotBooking: (value: boolean) => {
      multiSlotTouchedRef.current = true;
      setAllowMultiSlotBookingState(value);
    },
    bookingMode,
    setBookingMode,
    bookingIntervalMinutes,
    setBookingIntervalMinutes,
    bookingMaxStayMinutes,
    setBookingMaxStayMinutes,
    saveDefaultPolicy: () => saveDefaultPolicyMutation.mutate(),
    savingDefaultPolicy: saveDefaultPolicyMutation.isPending,
  };
}
