/**
 * pages/admin/DepartmentsPage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin view of department metrics.
 */

import { motion } from 'framer-motion'
import { Building2, AlertCircle, RefreshCcw, CheckCircle2, Clock } from 'lucide-react'

import { TopBar }             from '@/components/layout/TopBar'
import { SkeletonCard }       from '@/components/ui/Skeleton'
import { EmptyState }         from '@/components/ui/EmptyState'
import { Button }             from '@/components/ui/Button'
import { useDepartmentWorkloads } from '@/hooks/useAdmin'
import { pageTransition, stagger, fadeUp } from '@/lib/motion'

export default function AdminDepartmentsPage() {
  const { data: departments, isLoading, isError, refetch } = useDepartmentWorkloads()
  
  return (
    <motion.div
      variants={pageTransition}
      initial="hidden"
      animate="show"
      exit="exit"
      className="flex flex-col min-h-dvh bg-[#F9FAFB]"
    >
      <TopBar 
        title="Departments" 
        showBack 
        rightElement={
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCcw size={15} />
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto pb-24">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1,2,3].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : isError ? (
          <EmptyState
            Icon={AlertCircle}
            title="Couldn't load departments"
            action={<Button variant="secondary" onClick={() => refetch()}>Retry</Button>}
          />
        ) : (departments ?? []).length === 0 ? (
          <EmptyState
            Icon={Building2}
            title="No departments found"
            description="No departments registered in the system."
          />
        ) : (
          <motion.div variants={stagger.container} initial="hidden" animate="show" className="p-4 space-y-4">
            {(departments ?? []).map(dept => {
              const resolutionRate = dept.total > 0 
                ? Math.round((dept.resolved / dept.total) * 100) 
                : 0;

              return (
                <motion.div
                  key={dept.department_id}
                  variants={fadeUp}
                  className="bg-white rounded-3xl border border-[#E5E7EB] p-5 flex flex-col relative overflow-hidden"
                  style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 opacity-[0.03] pointer-events-none"
                       style={{ background: 'radial-gradient(circle, #F59E0B 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />

                  <div className="flex items-center gap-3 mb-4 relative z-10">
                    <div className="w-12 h-12 rounded-2xl bg-[#FEF3C7] flex items-center justify-center shrink-0">
                      <Building2 size={24} className="text-[#D97706]" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-[18px] font-extrabold text-[#111827] leading-tight">
                        {dept.department_name}
                      </h3>
                      <p className="text-[13px] font-medium text-[#6B7280] mt-0.5">
                        {dept.total} total cases
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-4 relative z-10">
                    <div className="bg-[#F9FAFB] border border-[#F3F4F6] rounded-2xl p-3">
                      <div className="flex items-center gap-1.5 mb-1 text-[#6B7280]">
                        <Clock size={14} />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Open</span>
                      </div>
                      <p className="text-[20px] font-extrabold text-[#111827]">{dept.open}</p>
                    </div>
                    <div className="bg-[#F9FAFB] border border-[#F3F4F6] rounded-2xl p-3">
                      <div className="flex items-center gap-1.5 mb-1 text-[#16A34A]">
                        <CheckCircle2 size={14} />
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">Resolved</span>
                      </div>
                      <p className="text-[20px] font-extrabold text-[#111827]">{dept.resolved}</p>
                    </div>
                  </div>

                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">Resolution Rate</span>
                      <span className="text-[12px] font-bold text-[#111827]">{resolutionRate}%</span>
                    </div>
                    <div className="h-2 w-full bg-[#F3F4F6] rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-[#F59E0B]"
                        initial={{ width: 0 }}
                        animate={{ width: `${resolutionRate}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                      />
                    </div>
                    <p className="text-[11px] text-[#9CA3AF] mt-2 font-medium">
                      Avg time: {dept.avg_resolution_hours ? `${dept.avg_resolution_hours.toFixed(1)} hours` : 'N/A'}
                    </p>
                  </div>

                </motion.div>
              )
            })}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
