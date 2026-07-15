/**
 * hooks/useOfficer.ts — Officer operation hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { officerApi } from '@/api/officer'
import { queryKeys } from '@/lib/queryClient'

export function useOfficerComplaints(params?: { skip?: number; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.officerComplaints(params),
    queryFn:  () => officerApi.complaints(params),
  })
}

export function useOfficerPending(params?: { skip?: number; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.officerPending(params),
    queryFn:  () => officerApi.pending(params),
  })
}

export function useOfficerInProgress(params?: { skip?: number; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.officerInProgress(params),
    queryFn:  () => officerApi.inProgress(params),
  })
}

export function useAcceptComplaint() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => officerApi.accept(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['officer'] })
      qc.invalidateQueries({ queryKey: ['complaints'] })
    },
  })
}

export function useResolveComplaint() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => officerApi.resolve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['officer'] })
      qc.invalidateQueries({ queryKey: ['complaints'] })
    },
  })
}

export function useAddProgress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) =>
      officerApi.addProgress(id, message),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.timeline(id) })
      qc.invalidateQueries({ queryKey: queryKeys.complaint(id) })
    },
  })
}
