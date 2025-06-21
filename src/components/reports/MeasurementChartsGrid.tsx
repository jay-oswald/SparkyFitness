
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Scale, Activity } from "lucide-react";
import ZoomableChart from "../ZoomableChart";
import { usePreferences } from "@/contexts/PreferencesContext";
import { debug, info, warn, error } from "@/utils/logging";

interface MeasurementData {
  date: string;
  weight?: number;
  neck?: number;
  waist?: number;
  hips?: number;
  steps?: number;
}

interface MeasurementChartsGridProps {
  measurementData: MeasurementData[];
  showWeightInKg: boolean;
  showMeasurementsInCm: boolean;
}

const MeasurementChartsGrid = ({ measurementData, showWeightInKg, showMeasurementsInCm }: MeasurementChartsGridProps) => {
  const { loggingLevel } = usePreferences();
  info(loggingLevel, 'MeasurementChartsGrid: Rendering component.');

  return (
    <>
      {/* Body Measurements Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Weight Chart */}
        <ZoomableChart title={`Weight (${showWeightInKg ? 'kg' : 'lbs'})`}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center">
                <Scale className="w-4 h-4 mr-2" />
                Weight ({showWeightInKg ? 'kg' : 'lbs'})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={measurementData.filter(d => d.weight)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip />
                    <Line type="monotone" dataKey="weight" stroke="#e74c3c" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </ZoomableChart>

        {/* Neck Chart */}
        <ZoomableChart title={`Neck (${showMeasurementsInCm ? 'cm' : 'inches'})`}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Neck ({showMeasurementsInCm ? 'cm' : 'inches'})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={measurementData.filter(d => d.neck)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip />
                    <Line type="monotone" dataKey="neck" stroke="#3498db" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </ZoomableChart>

        {/* Waist Chart */}
        <ZoomableChart title={`Waist (${showMeasurementsInCm ? 'cm' : 'inches'})`}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Waist ({showMeasurementsInCm ? 'cm' : 'inches'})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={measurementData.filter(d => d.waist)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip />
                    <Line type="monotone" dataKey="waist" stroke="#e74c3c" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </ZoomableChart>

        {/* Hips Chart */}
        <ZoomableChart title={`Hips (${showMeasurementsInCm ? 'cm' : 'inches'})`}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Hips ({showMeasurementsInCm ? 'cm' : 'inches'})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={measurementData.filter(d => d.hips)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip />
                    <Line type="monotone" dataKey="hips" stroke="#f39c12" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </ZoomableChart>
      </div>

      {/* Steps Chart */}
      <ZoomableChart title="Daily Steps">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="w-5 h-5 mr-2" />
              Daily Steps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={measurementData.filter(d => d.steps)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="steps" fill="#2ecc71" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </ZoomableChart>
    </>
  );
};

export default MeasurementChartsGrid;
