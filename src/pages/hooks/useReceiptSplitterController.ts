import { useEffect, useLayoutEffect, useMemo } from 'react'
import { useShallow } from 'zustand/shallow'
import { computeSplit } from '../../shared/logic/computation/split'
import { useDraftPersistence } from '../../shared/hooks/useDraftPersistence'
import { useReceiptUiStore } from '../../shared/stores/receiptUiStore'
import { useLoadingTicker } from '../../features/receipt-import'
import { useReceiptWorkspaceStore } from '../../features/receipt-workspace/store/receiptWorkspaceStore'

export function useReceiptSplitterController() {
  const {
    uxMode,
    setUxMode,
    isScanning,
    advanceLoadingMessage,
  } = useReceiptUiStore(
    useShallow((state) => ({
      uxMode: state.uxMode,
      setUxMode: state.setUxMode,
      isScanning: state.isScanning,
      advanceLoadingMessage: state.advanceLoadingMessage,
    })),
  )

  const {
    initialized,
    people,
    items,
    serviceCharge,
    gst,
    receiptTotalInput,
    initialize,
    reset,
    normalizeItemsForSimpleMode,
  } = useReceiptWorkspaceStore(
    useShallow((state) => ({
      initialized: state.initialized,
      people: state.people,
      items: state.items,
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
    () => computeSplit({ people, items, serviceCharge, gst }),
    [people, items, serviceCharge, gst],
  )

  useDraftPersistence({
    initialized,
    people,
    items,
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
