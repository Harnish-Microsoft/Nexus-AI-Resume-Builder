import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Zap, 
  PieChart as PieChartIcon,
  Calendar,
  RefreshCw,
  ArrowLeft
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend,
  BarChart,
  Bar
} from 'recharts';
import { motion } from 'motion/react';

interface AdminStats {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  cacheHitRatio: number;
}

interface UsageByDay {
  date: string;
  tokens: number;
  cost: number;
}

interface ModelUsage {
  name: string;
  value: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export const AdminDashboard: React.FC<{ onBack: () => void, isDarkMode: boolean }> = ({ onBack, isDarkMode }) => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [usageByDay, setUsageByDay] = useState<UsageByDay[]>([]);
  const [modelUsage, setModelUsage] = useState<ModelUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, usageRes, modelRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/usage-by-day'),
        fetch('/api/admin/model-usage')
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (usageRes.ok) setUsageByDay(await usageRes.json());
      if (modelRes.ok) setModelUsage(await modelRes.json());
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className={`min-h-screen p-6 transition-colors duration-300 ${isDarkMode ? 'bg-neutral-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-200 text-gray-600'}`}
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Admin Analytics Dashboard</h1>
          </div>
          <button 
            onClick={fetchData}
            disabled={isLoading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
              isDarkMode ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard 
            title="Total Requests" 
            value={stats?.totalRequests || 0} 
            icon={<BarChart3 className="w-6 h-6 text-blue-600" />}
            color="blue"
            isDarkMode={isDarkMode}
          />
          <StatCard 
            title="Total Tokens" 
            value={(stats?.totalTokens || 0).toLocaleString()} 
            icon={<Zap className="w-6 h-6 text-amber-600" />}
            color="amber"
            isDarkMode={isDarkMode}
          />
          <StatCard 
            title="Total Cost" 
            value={`$${(stats?.totalCost || 0).toFixed(4)}`} 
            icon={<DollarSign className="w-6 h-6 text-emerald-600" />}
            color="emerald"
            isDarkMode={isDarkMode}
          />
          <StatCard 
            title="Cache Hit Ratio" 
            value={`${(stats?.cacheHitRatio || 0).toFixed(1)}%`} 
            icon={<TrendingUp className="w-6 h-6 text-purple-600" />}
            color="purple"
            isDarkMode={isDarkMode}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Tokens Over Time */}
          <div className={`p-6 rounded-xl shadow-sm border transition-colors ${isDarkMode ? 'bg-neutral-900 border-white/10' : 'bg-white border-gray-100'}`}>
            <h3 className={`text-lg font-semibold mb-6 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              <Calendar className="w-5 h-5 text-gray-500" />
              Tokens Over Time
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={usageByDay}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#333' : '#eee'} />
                  <XAxis dataKey="date" stroke={isDarkMode ? '#999' : '#666'} fontSize={12} />
                  <YAxis stroke={isDarkMode ? '#999' : '#666'} fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: isDarkMode ? '#171717' : '#fff', 
                      borderColor: isDarkMode ? '#333' : '#eee',
                      color: isDarkMode ? '#fff' : '#000'
                    }}
                    itemStyle={{ color: isDarkMode ? '#fff' : '#000' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="tokens" 
                    stroke={isDarkMode ? '#10b981' : '#3b82f6'} 
                    strokeWidth={2} 
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Model Usage Distribution */}
          <div className={`p-6 rounded-xl shadow-sm border transition-colors ${isDarkMode ? 'bg-neutral-900 border-white/10' : 'bg-white border-gray-100'}`}>
            <h3 className={`text-lg font-semibold mb-6 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              <PieChartIcon className="w-5 h-5 text-gray-500" />
              Model Usage Distribution
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={modelUsage}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {modelUsage.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: isDarkMode ? '#171717' : '#fff', 
                      borderColor: isDarkMode ? '#333' : '#eee',
                      color: isDarkMode ? '#fff' : '#000'
                    }}
                  />
                  <Legend wrapperStyle={{ color: isDarkMode ? '#fff' : '#000' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Cost Over Time */}
        <div className={`p-6 rounded-xl shadow-sm border transition-colors ${isDarkMode ? 'bg-neutral-900 border-white/10' : 'bg-white border-gray-100'}`}>
          <h3 className={`text-lg font-semibold mb-6 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            <DollarSign className="w-5 h-5 text-gray-500" />
            Daily Cost Analysis
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={usageByDay}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#333' : '#eee'} />
                <XAxis dataKey="date" stroke={isDarkMode ? '#999' : '#666'} fontSize={12} />
                <YAxis stroke={isDarkMode ? '#999' : '#666'} fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDarkMode ? '#171717' : '#fff', 
                    borderColor: isDarkMode ? '#333' : '#eee',
                    color: isDarkMode ? '#fff' : '#000'
                  }}
                  formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']}
                />
                <Bar dataKey="cost" fill={isDarkMode ? '#10b981' : '#10b981'} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ title: string, value: string | number, icon: React.ReactNode, color: string, isDarkMode: boolean }> = ({ title, value, icon, color, isDarkMode }) => {
  const colorClasses: Record<string, string> = {
    blue: isDarkMode ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-600",
    amber: isDarkMode ? "bg-amber-500/10 text-amber-400" : "bg-amber-50 text-amber-600",
    emerald: isDarkMode ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-600",
    purple: isDarkMode ? "bg-purple-500/10 text-purple-400" : "bg-purple-50 text-purple-600",
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-6 rounded-xl shadow-sm border transition-colors ${isDarkMode ? 'bg-neutral-900 border-white/10' : 'bg-white border-gray-100'}`}
    >
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
        <div>
          <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{title}</p>
          <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{value}</p>
        </div>
      </div>
    </motion.div>
  );
};
