export interface FittingItem {
  labelKey: string;
  K: string;
}

export interface FittingGroup {
  groupKey: string;
  items: FittingItem[];
}

export const FITTINGS_CATALOG: FittingGroup[] = [
  // ── Valves ────────────────────────────────────────────────────────────────
  {
    groupKey: 'perdidasLocalizadasFittings.groups.valves',
    items: [
      { labelKey: 'perdidasLocalizadasFittings.items.gateValveFullyOpen', K: '0.15' },
      { labelKey: 'perdidasLocalizadasFittings.items.gateValveThreeQuarterOpen', K: '0.26' },
      { labelKey: 'perdidasLocalizadasFittings.items.gateValveHalfOpen', K: '2.1' },
      { labelKey: 'perdidasLocalizadasFittings.items.gateValveQuarterOpen', K: '17' },
      { labelKey: 'perdidasLocalizadasFittings.items.gateValveFullyOpenScrewed', K: '1.5' },
      { labelKey: 'perdidasLocalizadasFittings.items.gateValveFullyOpenFlanged', K: '0.19' },
      { labelKey: 'perdidasLocalizadasFittings.items.globeValvePlugDiskFullyOpen', K: '10' },
      { labelKey: 'perdidasLocalizadasFittings.items.globeValvePlugDiskThreeQuarterOpen', K: '13' },
      { labelKey: 'perdidasLocalizadasFittings.items.globeValvePlugDiskHalfOpen', K: '36' },
      { labelKey: 'perdidasLocalizadasFittings.items.globeValvePlugDiskQuarterOpen', K: '112' },
      { labelKey: 'perdidasLocalizadasFittings.items.angleValveFullyOpen', K: '4' },
      { labelKey: 'perdidasLocalizadasFittings.items.ballValveFullyOpen', K: '0.05' },
      { labelKey: 'perdidasLocalizadasFittings.items.ballValveClosed5deg', K: '0.05' },
      { labelKey: 'perdidasLocalizadasFittings.items.ballValveClosed10deg', K: '0.29' },
      { labelKey: 'perdidasLocalizadasFittings.items.ballValveClosed20deg', K: '1.56' },
      { labelKey: 'perdidasLocalizadasFittings.items.ballValveClosed40deg', K: '17.3' },
      { labelKey: 'perdidasLocalizadasFittings.items.ballValveClosed60deg', K: '206' },
      { labelKey: 'perdidasLocalizadasFittings.items.butterflyValveFullyOpen', K: '0.3' },
      { labelKey: 'perdidasLocalizadasFittings.items.butterflyValveClosed5deg', K: '0.24' },
      { labelKey: 'perdidasLocalizadasFittings.items.butterflyValveClosed10deg', K: '0.52' },
      { labelKey: 'perdidasLocalizadasFittings.items.butterflyValveClosed20deg', K: '1.54' },
      { labelKey: 'perdidasLocalizadasFittings.items.butterflyValveClosed40deg', K: '10.8' },
      { labelKey: 'perdidasLocalizadasFittings.items.butterflyValveClosed60deg', K: '118' },
      { labelKey: 'perdidasLocalizadasFittings.items.diaphragmValveFullyOpen', K: '2.3' },
      { labelKey: 'perdidasLocalizadasFittings.items.diaphragmValveThreeQuarterOpen', K: '2.6' },
      { labelKey: 'perdidasLocalizadasFittings.items.diaphragmValveHalfOpen', K: '4.3' },
      { labelKey: 'perdidasLocalizadasFittings.items.diaphragmValveQuarterOpen', K: '21' },
      { labelKey: 'perdidasLocalizadasFittings.items.swingCheckValveForwardFlow', K: '2' },
      { labelKey: 'perdidasLocalizadasFittings.items.liftCheckValve', K: '12' },
      { labelKey: 'perdidasLocalizadasFittings.items.waterMeterValve', K: '7' },
    ],
  },

  // ── Elbows / Bends ────────────────────────────────────────────────────────
  {
    groupKey: 'perdidasLocalizadasFittings.groups.elbows',
    items: [
      { labelKey: 'perdidasLocalizadasFittings.items.elbow90StandardThreaded', K: '1.5' },
      { labelKey: 'perdidasLocalizadasFittings.items.elbow90StandardFlanged', K: '0.3' },
      { labelKey: 'perdidasLocalizadasFittings.items.elbow90LongRadiusThreaded', K: '0.7' },
      { labelKey: 'perdidasLocalizadasFittings.items.elbow90LongRadiusFlanged', K: '0.2' },
      { labelKey: 'perdidasLocalizadasFittings.items.elbow90SmoothBendR1', K: '0.40' },
      { labelKey: 'perdidasLocalizadasFittings.items.elbow90SmoothBendR2', K: '0.25' },
      { labelKey: 'perdidasLocalizadasFittings.items.elbow90SmoothBendR4', K: '0.18' },
      { labelKey: 'perdidasLocalizadasFittings.items.elbow90Mitered90deg', K: '0.80' },
      { labelKey: 'perdidasLocalizadasFittings.items.elbow90Mitered60deg', K: '0.35' },
      { labelKey: 'perdidasLocalizadasFittings.items.elbow90Mitered45deg', K: '0.20' },
      { labelKey: 'perdidasLocalizadasFittings.items.elbow90Mitered30deg', K: '0.10' },
      { labelKey: 'perdidasLocalizadasFittings.items.elbow90Mitered15deg', K: '0.05' },
      { labelKey: 'perdidasLocalizadasFittings.items.elbow45StandardThreaded', K: '0.4' },
      { labelKey: 'perdidasLocalizadasFittings.items.elbow45StandardFlanged', K: '0.2' },
      { labelKey: 'perdidasLocalizadasFittings.items.elbow45Smooth', K: '0.35' },
      { labelKey: 'perdidasLocalizadasFittings.items.returnBend180Threaded', K: '1.5' },
      { labelKey: 'perdidasLocalizadasFittings.items.returnBend180Flanged', K: '0.2' },
      { labelKey: 'perdidasLocalizadasFittings.items.ubend180', K: '2.5' },
    ],
  },

  // ── Tees ──────────────────────────────────────────────────────────────────
  {
    groupKey: 'perdidasLocalizadasFittings.groups.tees',
    items: [
      { labelKey: 'perdidasLocalizadasFittings.items.teeFlangedDividingLineFlow', K: '0.2' },
      { labelKey: 'perdidasLocalizadasFittings.items.teeThreadedDividingLineFlow', K: '0.9' },
      { labelKey: 'perdidasLocalizadasFittings.items.teeFlangedDividingBranchFlow', K: '1.0' },
      { labelKey: 'perdidasLocalizadasFittings.items.teeThreadedDividingBranchFlow', K: '2.0' },
      { labelKey: 'perdidasLocalizadasFittings.items.teeStraightWay', K: '1.5' },
      { labelKey: 'perdidasLocalizadasFittings.items.teeBranch', K: '1.5' },
      { labelKey: 'perdidasLocalizadasFittings.items.teeCounterCurrent', K: '3.0' },
      { labelKey: 'perdidasLocalizadasFittings.items.teeLineFlow', K: '0.40' },
      { labelKey: 'perdidasLocalizadasFittings.items.teeBranchFlow', K: '1.80' },
      { labelKey: 'perdidasLocalizadasFittings.items.crossLineFlow', K: '0.50' },
      { labelKey: 'perdidasLocalizadasFittings.items.crossBranchFlow', K: '0.75' },
      { labelKey: 'perdidasLocalizadasFittings.items.wye45LineFlow', K: '0.30' },
      { labelKey: 'perdidasLocalizadasFittings.items.wye45BranchFlow', K: '0.50' },
    ],
  },

  // ── Entries and Exits ─────────────────────────────────────────────────────
  {
    groupKey: 'perdidasLocalizadasFittings.groups.entriesExits',
    items: [
      { labelKey: 'perdidasLocalizadasFittings.items.entranceSharpEdged', K: '0.50' },
      { labelKey: 'perdidasLocalizadasFittings.items.entranceProjecting', K: '0.80' },
      { labelKey: 'perdidasLocalizadasFittings.items.entranceRounded', K: '0.25' },
      { labelKey: 'perdidasLocalizadasFittings.items.entranceBellmouth', K: '0.05' },
      { labelKey: 'perdidasLocalizadasFittings.items.exitDischargeToTank', K: '1.0' },
      { labelKey: 'perdidasLocalizadasFittings.items.exitRoundedAgainstBaffle', K: '1.0' },
    ],
  },

  // ── Contractions ──────────────────────────────────────────────────────────
  {
    groupKey: 'perdidasLocalizadasFittings.groups.contractions',
    items: [
      { labelKey: 'perdidasLocalizadasFittings.items.suddenContractionD2D1_080', K: '0.18' },
      { labelKey: 'perdidasLocalizadasFittings.items.suddenContractionD2D1_050', K: '0.37' },
      { labelKey: 'perdidasLocalizadasFittings.items.suddenContractionD2D1_020', K: '0.49' },
      { labelKey: 'perdidasLocalizadasFittings.items.conicalContractionD2D1_080', K: '0.05' },
      { labelKey: 'perdidasLocalizadasFittings.items.conicalContractionD2D1_050', K: '0.07' },
      { labelKey: 'perdidasLocalizadasFittings.items.conicalContractionD2D1_020', K: '0.08' },
      { labelKey: 'perdidasLocalizadasFittings.items.suddenContractionGeneral', K: '0.5' },
    ],
  },

  // ── Expansions ────────────────────────────────────────────────────────────
  {
    groupKey: 'perdidasLocalizadasFittings.groups.expansions',
    items: [
      { labelKey: 'perdidasLocalizadasFittings.items.suddenExpansionD2D1_080', K: '0.16' },
      { labelKey: 'perdidasLocalizadasFittings.items.suddenExpansionD2D1_050', K: '0.57' },
      { labelKey: 'perdidasLocalizadasFittings.items.suddenExpansionD2D1_020', K: '0.92' },
      { labelKey: 'perdidasLocalizadasFittings.items.conicalExpansionD2D1_080', K: '0.03' },
      { labelKey: 'perdidasLocalizadasFittings.items.conicalExpansionD2D1_050', K: '0.08' },
      { labelKey: 'perdidasLocalizadasFittings.items.conicalExpansionD2D1_020', K: '0.13' },
    ],
  },

  // ── Meters ────────────────────────────────────────────────────────────────
  {
    groupKey: 'perdidasLocalizadasFittings.groups.meters',
    items: [
      { labelKey: 'perdidasLocalizadasFittings.items.waterMeter', K: '7' },
      { labelKey: 'perdidasLocalizadasFittings.items.orificeMeterSharpEdged', K: '2.0' },
      { labelKey: 'perdidasLocalizadasFittings.items.venturiMeter', K: '0.3' },
    ],
  },

  // ── Other Fitting Types ───────────────────────────────────────────────────
  {
    groupKey: 'perdidasLocalizadasFittings.groups.otherFittings',
    items: [
      { labelKey: 'perdidasLocalizadasFittings.items.couplingUnionThreaded', K: '0.08' },
      { labelKey: 'perdidasLocalizadasFittings.items.reducerEnlargerSudden', K: '#.##' },
      { labelKey: 'perdidasLocalizadasFittings.items.radiator', K: '3.0' },
      { labelKey: 'perdidasLocalizadasFittings.items.boiler', K: '2.5' },
      { labelKey: 'perdidasLocalizadasFittings.items.abruptVelocityChange', K: '1.0' },
      { labelKey: 'perdidasLocalizadasFittings.items.crossover', K: '0.5' },
      { labelKey: 'perdidasLocalizadasFittings.items.screenPerforatedPlateRounded', K: '0.5' },
      { labelKey: 'perdidasLocalizadasFittings.items.ybranchSymmetrical', K: '0.6' },
    ],
  },
];