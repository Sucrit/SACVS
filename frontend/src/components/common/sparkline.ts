interface SparklinePoint {
  x: number;
  y: number;
}

interface SparklineOptions {
  minimumCeiling?: number;
  headroomFactor?: number;
}

const getControlPoint = (
  current: SparklinePoint,
  previous: SparklinePoint | undefined,
  next: SparklinePoint | undefined,
  reverse?: boolean,
) => {
  const p = previous || current;
  const n = next || current;
  const smoothing = 0.15;
  const lengthX = n.x - p.x;
  const lengthY = n.y - p.y;
  const length = Math.sqrt(lengthX ** 2 + lengthY ** 2) * smoothing;
  const angle = Math.atan2(lengthY, lengthX) + (reverse ? Math.PI : 0);

  return {
    x: current.x + Math.cos(angle) * length,
    y: current.y + Math.sin(angle) * length,
  };
};

const generateSmoothPath = (points: SparklinePoint[]) => {
  if (points.length === 0) return '';

  return points.reduce((acc, point, index, allPoints) => {
    if (index === 0) return `M ${point.x},${point.y}`;
    const cps = getControlPoint(allPoints[index - 1], allPoints[index - 2], point);
    const cpe = getControlPoint(point, allPoints[index - 1], allPoints[index + 1], true);
    return `${acc} C ${cps.x},${cps.y} ${cpe.x},${cpe.y} ${point.x},${point.y}`;
  }, '');
};

export const buildSparkline = (counts: number[], options: SparklineOptions = {}) => {
  const observedMax = Math.max(...counts, 0);
  const minimumCeiling = options.minimumCeiling ?? 4;
  const headroomFactor = options.headroomFactor ?? 1.25;
  const scaledObservedMax = observedMax > 0 ? Math.ceil(observedMax * headroomFactor) : 0;
  const ceiling = Math.max(minimumCeiling, scaledObservedMax, 1);

  const points = counts.map((count, index) => {
    const x = (index / Math.max(counts.length - 1, 1)) * 100;
    const normalized = Math.min(Math.max(count / ceiling, 0), 1);
    const y = 92 - normalized * 64;
    return { x, y: Number.isFinite(y) ? y : 92 };
  });

  const pathD = generateSmoothPath(points);
  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x},100 L ${points[0].x},100 Z`
    : '';

  return {
    areaD,
    pathD,
    peak: observedMax,
    ceiling,
  };
};
