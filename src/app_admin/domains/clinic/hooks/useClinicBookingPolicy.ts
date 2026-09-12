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

export type ClinicDraftAssignment = {
  required: boolean;
  windowStart: string;
  windowEnd: string;
  intervalMinutes: 30 | 60;
  maxStayMinutes: number;
  capacity: number;
  bookingStart: string;
  bookingEnd: string;
  setBookingStart: (value: string) => void;
  setBookingEnd: (value: string) => void;
};

export function useClinicDraftAssignment({
  required,
  windowStart,
  windowEnd,
  intervalMinutes,
  maxStayMinutes,
  capacity,
}: {
  required: boolean;
  windowStart: string;
  windowEnd: string;
  intervalMinutes: 30 | 60;
  maxStayMinutes: number;
  capacity: number;
}): ClinicDraftAssignment {
  const [bookingStart, setBookingStart] = useState("");
  const [bookingEnd, setBookingEnd] = useState("");

  useEffect(() => {
    setBookingStart("");
    setBookingEnd("");
  }, [intervalMinutes, maxStayMinutes, required, windowEnd, windowStart]);

  return {
    required,
    windowStart,
    windowEnd,
    intervalMinutes,
    maxStayMinutes,
    capacity,
    bookingStart,
    bookingEnd,
    setBookingStart,
    setBookingEnd,
  };
}

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
  const [bookingModeChosen, setBookingModeChosen] = useState(Boolean(sourceSession));
  const multiSlotTouchedRef = useRef(false);
  const bookingPolicyTouchedRef = useRef(false);

  useEffect(() => {
    if (sourceSession || !settings) return;
    if (!multiSlotTouchedRef.current) {
      setAllowMultiSlotBookingState(settings.multi_slot_booking_default === true);
    }
    if (!bookingPolicyTouchedRef.current) {
      setBookingMode(settings.booking_mode);
      setBookingIntervalMinutes(settings.booking_interval_minutes);
      setBookingMaxStayMinutes(settings.booking_max_stay_minutes);
    }
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
    bookingModeChosen,
    selectBookingMode: (value: "fixed_slot" | "time_range") => {
      bookingPolicyTouchedRef.current = true;
      setBookingMode(value);
      if (value === "time_range") {
        multiSlotTouchedRef.current = true;
        setAllowMultiSlotBookingState(false);
        setAllowTimePreference(false);
      }
      setBookingModeChosen(true);
    },
    resetBookingModeChoice: () => {
      if (!sourceSession) setBookingModeChosen(false);
    },
    setBookingMode: (value: "fixed_slot" | "time_range") => {
      bookingPolicyTouchedRef.current = true;
      setBookingMode(value);
    },
    bookingIntervalMinutes,
    setBookingIntervalMinutes: (value: 30 | 60) => {
      bookingPolicyTouchedRef.current = true;
      setBookingIntervalMinutes(value);
    },
    bookingMaxStayMinutes,
    setBookingMaxStayMinutes: (value: number) => {
      bookingPolicyTouchedRef.current = true;
      setBookingMaxStayMinutes(value);
    },
    saveDefaultPolicy: () => saveDefaultPolicyMutation.mutate(),
    savingDefaultPolicy: saveDefaultPolicyMutation.isPending,
  };
}
