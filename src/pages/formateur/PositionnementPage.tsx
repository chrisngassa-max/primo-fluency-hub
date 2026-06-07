import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Sparkles, ListChecks, History, Send, 
  ExternalLink, Copy, Download, CheckCircle2, 
  AlertCircle, ChevronRight, Play, Eye
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import TestsEntreePage from "@/pages/formateur/TestsEntree";

export default function PositionnementPage() {
  const [activeTab, setActiveTab] = useState("diagnostic");
  const queryClient = useQueryClient();

  // --- 1. Queries ---
  const { data: tests, isLoading: isLoadingTests } = useQuery({
    queryKey: ["placement-tests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("placement_tests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: attempts, isLoading: isLoadingAttempts } = useQuery({
    queryKey: ["placement-attempts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("placement_test_attempts")
        .select(`
          *,
          test:placement_tests(title),
          results:placement_test_results(*)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // --- 2. Mutations ---
  const generateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data, error } = await supabase.functions.invoke("generate-placement-test", {
        body: payload
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Test en cours de génération...");
      queryClient.invalidateQueries({ queryKey: ["placement-tests"] });
      setActiveTab("mes-tests");
    },
    onError: (err) => toast.error(`Erreur: ${err.message}`),
  });

  const publishMutation = useMutation({
    mutationFn: async (testId: string) => {
      const { error } = await supabase
        .from("placement_tests")
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('id', testId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Test publié avec succès !");
      queryClient.invalidateQueries({ queryKey: ["placement-tests"] });
    },
  });

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#0b234a] tracking-tight flex items-center gap-3">
            <ListChecks className="h-8 w-8 text-[#f59e0b]" />
            Test de Positionnement
          </h1>
          <p className="text-slate-500 font-medium mt-1">
            Générez les tests, réalisez le diagnostic individuel et suivez les résultats depuis un seul espace.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-white p-1 shadow-sm border border-slate-100 mb-8 lg:grid-cols-4">
          <TabsTrigger value="diagnostic" className="px-4 py-2.5 data-[state=active]:bg-[#0b234a] data-[state=active]:text-white flex items-center justify-center gap-2">
            <ListChecks className="h-4 w-4" />
            Diagnostic individuel
          </TabsTrigger>
          <TabsTrigger value="generer" className="px-6 py-2.5 rounded-lg data-[state=active]:bg-[#0b234a] data-[state=active]:text-white flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Générer
          </TabsTrigger>
          <TabsTrigger value="mes-tests" className="px-6 py-2.5 rounded-lg data-[state=active]:bg-[#0b234a] data-[state=active]:text-white flex items-center gap-2">
            <History className="h-4 w-4" />
            Mes tests
          </TabsTrigger>
          <TabsTrigger value="resultats" className="px-6 py-2.5 rounded-lg data-[state=active]:bg-[#0b234a] data-[state=active]:text-white flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Résultats
          </TabsTrigger>
        </TabsList>

        <TabsContent value="diagnostic" className="outline-none">
          <TestsEntreePage embedded />
        </TabsContent>

        {/* --- TAB: GENERER --- */}
        <TabsContent value="generer" className="outline-none">
          <Card className="border-none shadow-xl bg-white overflow-hidden">
            <div className="bg-[#0b234a] p-6 text-white">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[#f59e0b]" />
                Nouvelle génération IA
              </h2>
              <p className="text-white/70 text-sm mt-1">Claude va concevoir un test de 24 items avec une progression CECRL.</p>
            </div>
            <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title" className="text-sm font-bold text-[#0b234a]">Titre du test</Label>
                    <Input id="title" placeholder="ex: Positionnement TCF IRN - Juin 2024" className="mt-1.5 h-12" />
                  </div>
                  <div>
                    <Label className="text-sm font-bold text-[#0b234a]">Niveaux visés</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {['A1', 'A2', 'B1'].map(n => (
                        <Badge key={n} variant="outline" className="px-3 py-1 cursor-pointer bg-slate-50 border-slate-200 text-slate-700 hover:bg-[#0b234a] hover:text-white transition-colors">
                          {n}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                  <h3 className="font-bold text-[#0b234a] mb-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-[#f59e0b]" />
                    Configuration standard
                  </h3>
                  <ul className="text-sm text-slate-600 space-y-2">
                    <li className="flex items-center gap-2">• 10 items CE (Compréhension Écrite)</li>
                    <li className="flex items-center gap-2">• 10 items CO (Compréhension Orale)</li>
                    <li className="flex items-center gap-2">• 2 items EE (Expression Écrite)</li>
                    <li className="flex items-center gap-2">• 2 items EO (Expression Orale)</li>
                  </ul>
                </div>
              </div>
              <Button 
                onClick={() => generateMutation.mutate({ title: (document.getElementById('title') as any).value })}
                disabled={generateMutation.isPending}
                className="w-full h-14 text-lg font-bold bg-[#0b234a] hover:bg-[#0b234a]/90 shadow-lg group"
              >
                {generateMutation.isPending ? "Génération en cours..." : "Lancer la génération IA"}
                <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- TAB: MES TESTS --- */}
        <TabsContent value="mes-tests" className="outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {isLoadingTests ? (
              <p>Chargement...</p>
            ) : tests?.map((test) => (
              <Card key={test.id} className="cap-card hover:shadow-xl transition-all border-none overflow-hidden group">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={test.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>
                          {test.status === 'published' ? 'Publié' : 'Brouillon'}
                        </Badge>
                        <span className="text-xs text-slate-400 font-medium">v{test.version}</span>
                      </div>
                      <h3 className="font-bold text-xl text-[#0b234a]">{test.title}</h3>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-100"><Eye className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-slate-50 p-3 rounded-lg text-center">
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Items</p>
                      <p className="font-bold text-[#0b234a]">24</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg text-center">
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Tentatives</p>
                      <p className="font-bold text-[#0b234a]">12</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg text-center">
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Niveaux</p>
                      <p className="font-bold text-[#0b234a]">A1-B1</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100">
                    {test.status !== 'published' ? (
                      <Button onClick={() => publishMutation.mutate(test.id)} className="bg-green-600 hover:bg-green-700 flex-1 h-10 gap-2">
                        <CheckCircle2 className="h-4 w-4" /> Publier
                      </Button>
                    ) : (
                      <>
                        <Button variant="outline" className="flex-1 h-10 gap-2 border-slate-200" onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/#/eleve/test-positionnement?token=${test.play_token}`);
                          toast.success("Lien copié !");
                        }}>
                          <Copy className="h-4 w-4" /> Lien
                        </Button>
                        <Button variant="outline" className="flex-1 h-10 gap-2 border-slate-200" onClick={() => {
                          const apiUrl = `${window.location.origin}/functions/v1/get-placement-test?token=${test.play_token}`;
                          navigator.clipboard.writeText(apiUrl);
                          toast.success("URL API copiée !");
                        }}>
                          <ExternalLink className="h-4 w-4" /> API
                        </Button>
                        <Button variant="outline" className="h-10 w-10 p-0 border-slate-200">
                          <Download className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* --- TAB: RESULTATS --- */}
        <TabsContent value="resultats" className="outline-none">
          <Card className="border-none shadow-xl overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#0b234a] text-white">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">Élève / Candidat</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">Test / Source</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">Niveau Estimé</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">Score</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">Date</th>
                    <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attempts?.map((attempt) => (
                    <tr key={attempt.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-bold text-[#0b234a]">{attempt.student_name || 'Anonyme'}</div>
                        <div className="text-[10px] text-slate-400 font-medium">ID: {attempt.id.slice(0, 8)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-700">{attempt.test?.title}</div>
                        <Badge variant="outline" className="text-[10px] h-4 mt-1 bg-white border-slate-200">
                          {(attempt as any).source === 'site_externe' ? 'Site Web' : 'App Interne'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge className="bg-[#0b234a] text-white px-3 py-0.5 rounded-full font-bold">
                          {attempt.estimated_level}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-[#f59e0b] h-full" style={{ width: `${(attempt.total_score / attempt.max_score) * 100}%` }}></div>
                          </div>
                          <span className="text-sm font-bold text-[#0b234a]">{Math.round((attempt.total_score / attempt.max_score) * 100)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-medium">
                        {format(new Date(attempt.created_at), "d MMMM yyyy, HH:mm", { locale: fr })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-[#0b234a] hover:text-white">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
