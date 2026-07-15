/**
 * hooks/useComplaints.ts — Complaint query + mutation hooks (full CRUD)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { complaintsApi, type ComplaintsParams } from '@/api/complaints'
import { queryKeys } from '@/lib/queryClient'

export function useComplaints(params?: ComplaintsParams) {
  return useQuery({
    queryKey: queryKeys.complaints(params),
    queryFn:  () => complaintsApi.list(params),
  })
}

export function useMyComplaints(params?: ComplaintsParams) {
  return useQuery({
    queryKey: queryKeys.myComplaints(params),
    queryFn:  () => complaintsApi.my(params),
  })
}

export function useComplaint(id: string) {
  return useQuery({
    queryKey: queryKeys.complaint(id),
    queryFn:  () => complaintsApi.get(id),
    enabled:  Boolean(id),
  })
}

export function useComplaintTimeline(id: string) {
  return useQuery({
    queryKey: queryKeys.timeline(id),
    queryFn:  () => complaintsApi.timeline(id),
    enabled:  Boolean(id),
  })
}

export function useCreateComplaint() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: complaintsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['complaints'] })
    },
  })
}

export function useUpdateComplaint() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { title?: string; description?: string } }) =>
      complaintsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['complaints'] })
    },
  })
}

export function useDeleteComplaint() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => complaintsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['complaints'] })
    },
  })
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn:  () => complaintsApi.categories(),
    staleTime: 1000 * 60 * 60,
  })
}
