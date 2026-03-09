import { useEffect, useLayoutEffect, useMemo } from 'react'
import { useShallow } from 'zustand/shallow'
import { computeSplit } from '../../shared/logic/computation/split'
import { useDraftPersistence } from '../../shared/hooks/useDraftPersistence'
import { useReceiptStore } from '../../shared/stores/receiptStore'
import { useLoadingTicker } from '../../features/receipt-scanner'

export function useReceiptSplitterController() {
  const {
    uxMode,
    setUxMode,
    isScanning,
    advanceLoadingMessage,
    initialized,
    people,
    items,
    discount,
    serviceCharge,
    gst,
    receiptTotalInput,
    initialize,
    reset,
    normalizeItemsForSimpleMode,
  } = useReceiptStore(
    useShallow((state) => ({
      uxMode: state.uxMode,
      setUxMode: state.setUxMode,
      isScanning: state.isScanning,
      advanceLoadingMessage: state.advanceLoadingMessage,
      initialized: state.initialized,
      people: state.people,
      items: state.items,
      discount: state.discount,
      serviceCharge: state.serviceCharge,
      gst: state.gst,
      receiptTotalInput: state.receiptTotalInput,
      initialize: state.initialize,
      reset: state.reset,
      normalizeItemsForSimpleMode: state.normalizeItemsForSimpleMode,
    })),
  )

  useLayoutEffect(() => {
    if (!initialized) {
      initialize(uxMode)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      reset()
    }
  }, [reset])

  const split = useMemo(
    () => computeSplit({ people, items, discount, serviceCharge, gst }),
    [people, items, discount, serviceCharge, gst],
  )

  useDraftPersistence({
    initialized,
    people,
    items,
    discount,
    serviceCharge,
    gst,
    receiptTotalInput,
    split,
  })
  useLoadingTicker({ isActive: isScanning, onTick: advanceLoadingMessage })

  const handleUxModeChange = (nextMode: 'simple' | 'advanced') => {
    if (nextMode === uxMode) {
      return
    }

    if (nextMode === 'simple') {
      normalizeItemsForSimpleMode()
    }

    setUxMode(nextMode)
  }

  return {
    uxMode,
    handleUxModeChange,
  }
}
