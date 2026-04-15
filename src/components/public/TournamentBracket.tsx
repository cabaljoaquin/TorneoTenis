'use client'

import { motion } from 'framer-motion'

interface Match {
  id: string
  p1: string
  p2: string
  scoreStr?: string
  scoreList?: {s1: number, s2: number, tb1?: number, tb2?: number}[]
  p1Wins?: boolean
  p2Wins?: boolean
  finished?: boolean
}

interface Round {
  title: string
  matches: Match[]
}

export default function TournamentBracket({ rounds }: { rounds: Round[] }) {
  // Animación de entrada general del bracket
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  }

  const columnVariants = {
    hidden: { opacity: 0, x: 20 },
    show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: 'easeOut' } }
  }

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="flex overflow-x-auto py-8 px-4 gap-12 no-scrollbar"
    >
      {rounds.map((round, rIndex) => (
        <motion.div 
          key={round.title} 
          variants={columnVariants}
          className="flex flex-col gap-8 min-w-[220px]"
          style={{ justifyContent: 'space-around' }}
        >
          <h3 className="text-center text-sm font-semibold text-brand-400 mb-2 uppercase tracking-wider">{round.title}</h3>
          <div className="flex flex-col h-full gap-6" style={{ justifyContent: 'space-around' }}>
            {round.matches.map((match) => {
              return (
                <div 
                  key={match.id} 
                  className="relative bg-surface-card border border-surface-border rounded-lg overflow-hidden flex flex-col shadow-lg shadow-black/20"
                >
                  <div className={`px-3 py-2 flex justify-between items-center border-b border-surface-border/50 ${match.p1Wins ? 'text-brand-400 font-bold bg-brand-500/10' : match.finished ? 'text-slate-500' : 'text-slate-300'}`}>
                    <span className="text-sm truncate pr-2 flex items-center gap-2">
                      {match.p1}
                      {match.p1Wins && <span title="Ganador">🏆</span>}
                    </span>
                    <div className="flex gap-2.5 font-mono text-sm ml-4">
                      {match.scoreList?.map((set, i) => (
                        <div key={i} className="flex relative items-start w-3 justify-center">
                          <span>{set.s1}</span>
                          {set.tb1 !== undefined && <span className="absolute -right-2 -top-1 text-[8px] opacity-70">{set.tb1}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className={`px-3 py-2 flex justify-between items-center ${match.p2Wins ? 'text-brand-400 font-bold bg-brand-500/10' : match.finished ? 'text-slate-500' : 'text-slate-300'}`}>
                    <span className="text-sm truncate pr-2 flex items-center gap-2">
                       {match.p2}
                       {match.p2Wins && <span title="Ganador">🏆</span>}
                    </span>
                    <div className="flex gap-2.5 font-mono text-sm ml-4">
                      {match.scoreList?.map((set, i) => (
                        <div key={i} className="flex relative items-start w-3 justify-center">
                          <span>{set.s2}</span>
                          {set.tb2 !== undefined && <span className="absolute -right-2 -top-1 text-[8px] opacity-70">{set.tb2}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Conector visual derecho para las ramas */}
                  {rIndex < rounds.length - 1 && (
                    <div className="absolute top-1/2 -right-6 w-6 h-px bg-surface-border" />
                  )}
                  {/* Conector visual izquierdo */}
                  {rIndex > 0 && (
                    <div className="absolute top-1/2 -left-6 w-6 h-px bg-surface-border" />
                  )}
                </div>
              )
            })}
          </div>
        </motion.div>
      ))}
    </motion.div>
  )
}
