import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";

interface OnboardingState {
  checklist: Record<string, boolean>;
  completedAt: string | null;
  completionPercent: number;
  nextTip: string | null;
}

export function useOnboarding() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<OnboardingState>({
    queryKey: ["/api/onboarding"],
  });

  const markItem = useMutation({
    mutationFn: async (item: string) => {
      const res = await apiRequest("PATCH", "/api/onboarding/checklist", { item });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
    },
  });

  return {
    checklist: data?.checklist ?? {},
    completionPercent: data?.completionPercent ?? 0,
    nextTip: data?.nextTip ?? null,
    isComplete: !!data?.completedAt,
    isLoading,
    markItem: (item: string) => markItem.mutate(item),
  };
}
