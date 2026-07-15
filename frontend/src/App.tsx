/**
 * App.tsx — Root application component
 *
 * Provides:
 *   - RouterProvider (createBrowserRouter)
 *   - QueryClientProvider (TanStack Query)
 *   - Suspense fallback (lazy pages)
 */

import { Suspense } from 'react'
import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { router } from '@/router'
import { queryClient } from '@/lib/queryClient'
import { PageSpinner } from '@/components/ui/Spinner'
import { ToastProvider } from '@/components/ui/Toast'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <Suspense fallback={<PageSpinner />}>
          <RouterProvider router={router} />
        </Suspense>
      </ToastProvider>
    </QueryClientProvider>
  )
}
