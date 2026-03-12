import { useEffect, useRef } from 'react';
import { createChart, ColorType, CrosshairMode, CandlestickSeries, HistogramSeries } from 'lightweight-charts';

interface CandleData {
  time: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface ChartProps {
  data: CandleData[];
  height?: number;
}

export function ChartWidget({ data, height = 350 }: ChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#EAEAEA',
      },
      grid: {
        vertLines: { color: '#1A1A2E' },
        horzLines: { color: '#1A1A2E' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      width: container.clientWidth,
      height: height,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#1E1E2E',
      },
      rightPriceScale: {
        borderColor: '#1E1E2E',
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#00FF88',
      downColor: '#FF3366',
      borderVisible: false,
      wickUpColor: '#00FF88',
      wickDownColor: '#FF3366',
    });

    if (data.length > 0) {
      candlestickSeries.setData(data as any);

      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: '#1A1A2E',
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      });

      chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });

      const volumeData = data.map(d => ({
        time: d.time,
        value: d.volume ?? 0,
        color: (d.close ?? 0) > (d.open ?? 0) ? 'rgba(0, 255, 136, 0.3)' : 'rgba(255, 51, 102, 0.3)',
      }));

      volumeSeries.setData(volumeData as any);
      chart.timeScale().fitContent();
    }

    const handleResize = () => {
      if (container) {
        chart.applyOptions({ width: container.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data, height]);

  return (
    <div ref={chartContainerRef} className="w-full" style={{ height }} />
  );
}
