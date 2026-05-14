import React from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, AlertCircle, ArrowRight, 
  Download, Share2, BookOpen, GraduationCap,
  TrendingUp, Award, Target
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, 
  PolarRadiusAxis, ResponsiveContainer 
} from 'recharts';

export default function PositionnementResultat() {
  const { attemptId } = useParams();

  const { data: attemptData, isLoading, error } = useQuery({
    queryKey: ["placement-result", attemptId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("placement_test_attempts")
        .select(`
          *,
          test:placement_tests(title),
          results:placement_test_results(*)
        `)
        .eq("id", attemptId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!attemptId,
  });

  if (isLoading) return <div className="p-20 text-center">Analyse de vos résultats...</div>;
  if (error) return <div className="p-20 text-center text-red-500">Erreur: {error.message}</div>;

  const result = attemptData?.results;
  const radarData = [
    { skill: 'Compréhension Écrite', value: result?.ce_score_pct || 0 },
    { skill: 'Compréhension Orale', value: result?.co_score_pct || 0 },
    { skill: 'Expression Écrite', value: 50 }, // Placeholder for review
    { skill: 'Expression Orale', value: 50 }, // Placeholder for review
  ];

  return (
    <div className="min-h-screen bg-[#fcfaf7] p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 px-4 py-1 rounded-full text-sm font-bold border-green-200">
            Bilan terminé avec succès
          </Badge>
          <h1 className="text-4xl font-extrabold text-[#0b234a] tracking-tight">
            Votre profil linguistique : <span className="text-[#f59e0b]">{result?.global_level}</span>
          </h1>
          <p className="text-slate-500 text-lg font-medium">
            Basé sur votre performance au {attemptData?.test?.title}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Stats & Radar */}
          <div className="lg:col-span-2 space-y-8">
            <Card className="border-none shadow-xl overflow-hidden bg-white">
              <CardHeader className="bg-[#0b234a] text-white">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-[#f59e0b]" />
                  Analyse des compétences
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="skill" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar
                        name="Votre niveau"
                        dataKey="value"
                        stroke="#f59e0b"
                        fill="#f59e0b"
                        fillOpacity={0.4}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-8">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Compréhension</p>
                    <p className="text-lg font-bold text-[#0b234a]">{Math.round(((result?.ce_score_pct || 0) + (result?.co_score_pct || 0)) / 2)}%</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Expression</p>
                    <p className="text-lg font-bold text-[#0b234a]">À valider</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Strengths & Weaknesses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-none shadow-xl bg-green-50/30 border-l-4 border-l-green-500">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-green-800">
                    <Award className="h-5 w-5" />
                    Points forts
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {result?.strengths?.map((s: string, i: number) => (
                    <div key={i} className="flex gap-2 text-sm text-green-700 font-medium">
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                      {s}
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card className="border-none shadow-xl bg-amber-50/30 border-l-4 border-l-amber-500">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-amber-800">
                    <Target className="h-5 w-5" />
                    Axes d'amélioration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {result?.weaknesses?.map((w: string, i: number) => (
                    <div key={i} className="flex gap-2 text-sm text-amber-700 font-medium">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      {w}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Right Column: Next Steps */}
          <div className="space-y-8">
            <Card className="border-none shadow-xl bg-[#0b234a] text-white">
              <CardHeader>
                <CardTitle className="text-lg">Prochaines étapes</CardTitle>
                <CardDescription className="text-white/60 font-medium italic">
                  "{result?.teacher_notes}"
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <p className="text-xs font-bold text-white/50 uppercase">Groupe recommandé</p>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-[#f59e0b] flex items-center justify-center text-xl font-bold">
                      {result?.global_level?.split('_')[0]}
                    </div>
                    <span className="font-bold text-lg">{result?.recommended_group}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-bold text-white/50 uppercase">Parcours conseillé</p>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ArrowRight className="h-4 w-4 text-[#f59e0b]" />
                    {result?.recommended_pathway}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-xl bg-white">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-[#f59e0b]" />
                  Remédiation
                </CardTitle>
                <p className="text-xs text-slate-400">Exercices personnalisés pour progresser</p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {result?.remediation_exercises?.map((ex: any) => (
                    <Link key={ex.id} to={`/eleve/exercices`} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors group">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-[10px] h-5 bg-slate-50">{ex.competence}</Badge>
                        <span className="text-sm font-bold text-slate-700 truncate max-w-[150px]">{ex.titre}</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-[#f59e0b] group-hover:translate-x-1 transition-all" />
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="border-slate-200 h-12 font-bold text-slate-700 gap-2">
                <Download className="h-4 w-4" /> PDF
              </Button>
              <Button variant="outline" className="border-slate-200 h-12 font-bold text-slate-700 gap-2">
                <Share2 className="h-4 w-4" /> Partager
              </Button>
            </div>
          </div>
        </div>

        <div className="flex justify-center pt-8">
          <Button asChild variant="ghost" className="text-slate-500 hover:text-[#0b234a] font-bold">
            <Link to="/eleve">
              Retour au tableau de bord
            </Link>
          </Button>
        </div>

      </div>
    </div>
  );
}
