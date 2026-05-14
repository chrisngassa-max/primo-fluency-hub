import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronRight, ChevronLeft, Send, AlertTriangle } from "lucide-react";

export default function PositionnementPassation() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0); // 0: Accueil, 1: CE, 2: CO, 3: EE, 4: EO, 5: Fin
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [answers, setAnswers] = useState<any[]>([]);
  const [studentName, setStudentName] = useState("");

  // 1. Fetch test data from public endpoint
  const { data: testPayload, isLoading, error } = useQuery({
    queryKey: ["public-placement-test", token || 'latest'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-placement-test", {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        queries: token ? { token } : {}
      });
      if (error) throw error;
      return data;
    },
    enabled: true,
  });

  // 2. Group items by skill
  const groupedItems = testPayload?.items ? {
    CE: testPayload.items.filter((i: any) => i.skill === 'CE'),
    CO: testPayload.items.filter((i: any) => i.skill === 'CO'),
    EE: testPayload.items.filter((i: any) => i.skill === 'EE'),
    EO: testPayload.items.filter((i: any) => i.skill === 'EO'),
  } : null;

  const currentSkill = ["", "CE", "CO", "EE", "EO"][currentStep];
  const currentItems = groupedItems ? (groupedItems as any)[currentSkill] : [];
  const currentItem = currentItems ? currentItems[currentItemIndex] : null;

  // 3. Mutation for submission
  const submitMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data, error } = await supabase.functions.invoke("score-placement-test", {
        body: payload
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Test terminé ! Calcul du bilan...");
      navigate(`/eleve/test-positionnement/resultat/${data.attempt_id}`);
    },
    onError: (err) => toast.error(`Erreur lors de l'envoi: ${err.message}`),
  });

  const handleAnswerChange = (answer: string) => {
    setAnswers(prev => {
      const filtered = prev.filter(a => a.item_id !== currentItem.id);
      return [...filtered, { item_id: currentItem.id, answer, time_spent: 0 }];
    });
  };

  const nextItem = () => {
    if (currentItemIndex < currentItems.length - 1) {
      setCurrentItemIndex(prev => prev + 1);
    } else {
      setCurrentStep(prev => prev + 1);
      setCurrentItemIndex(0);
    }
  };

  if (isLoading) return <div className="p-20 text-center">Chargement du test...</div>;
  if (error) return <div className="p-20 text-center text-red-500">Erreur: {error.message}</div>;

  return (
    <div className="min-h-screen bg-[#fcfaf7] p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header Disclaimer */}
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-center gap-3 text-amber-800 text-sm font-medium">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          Test pédagogique non officiel — ne remplace pas un examen officiel TCF IRN.
        </div>

        {/* Step: Accueil */}
        {currentStep === 0 && (
          <Card className="border-none shadow-xl">
            <CardHeader className="text-center p-10 bg-[#0b234a] text-white rounded-t-xl">
              <CardTitle className="text-3xl font-bold">{testPayload.test.title}</CardTitle>
              <p className="mt-2 text-white/70">Positionnement CECRL (A1, A2, B1)</p>
            </CardHeader>
            <CardContent className="p-10 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-bold text-[#0b234a] text-lg">Instructions</h3>
                  <ul className="space-y-2 text-slate-600">
                    <li>• Durée estimée : 45 minutes</li>
                    <li>• 4 parties : Écrit et Oral</li>
                    <li>• Ne pas rafraîchir la page pendant le test</li>
                  </ul>
                </div>
                <div className="space-y-4">
                  <Label htmlFor="name" className="font-bold text-[#0b234a]">Votre Nom et Prénom</Label>
                  <Input 
                    id="name" 
                    value={studentName} 
                    onChange={(e) => setStudentName(e.target.value)} 
                    placeholder="Jean Dupont"
                    className="h-12 border-slate-200"
                  />
                </div>
              </div>
              <Button 
                disabled={!studentName.trim()}
                onClick={() => setCurrentStep(1)}
                className="w-full h-14 bg-[#f59e0b] hover:bg-[#d97706] text-white font-bold text-lg rounded-xl shadow-lg"
              >
                Commencer le test
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Steps: Items (CE, CO, EE, EO) */}
        {currentStep > 0 && currentStep < 5 && currentItem && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-4">
                <Badge className="bg-[#0b234a] text-white px-3 py-1 font-bold">{currentSkill}</Badge>
                <span className="text-sm font-bold text-slate-400">Question {currentItemIndex + 1} / {currentItems.length}</span>
              </div>
              <div className="w-1/3">
                <Progress value={(currentStep - 1) * 25 + (currentItemIndex / currentItems.length) * 25} className="h-2" />
              </div>
            </div>

            <Card className="border-none shadow-xl overflow-hidden">
              <CardContent className="p-8 space-y-8">
                
                {/* Support Section */}
                {currentItem.support && (
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 font-serif italic text-lg leading-relaxed text-slate-800">
                    {currentItem.support}
                  </div>
                )}

                {/* Question Section */}
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-[#0b234a] leading-tight">
                    {currentItem.question}
                  </h3>

                  {/* QCM Options (CE/CO) */}
                  {['CE', 'CO'].includes(currentSkill) ? (
                    <RadioGroup 
                      value={answers.find(a => a.item_id === currentItem.id)?.answer || ""} 
                      onValueChange={handleAnswerChange}
                      className="grid grid-cols-1 gap-3"
                    >
                      {currentItem.options?.map((opt: any) => (
                        <Label 
                          key={opt.id}
                          className={`flex items-center gap-4 p-5 rounded-xl border-2 cursor-pointer transition-all ${
                            answers.find(a => a.item_id === currentItem.id)?.answer === opt.id 
                            ? "border-[#f59e0b] bg-amber-50" 
                            : "border-slate-100 hover:border-slate-200 bg-white"
                          }`}
                        >
                          <RadioGroupItem value={opt.id} className="sr-only" />
                          <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            answers.find(a => a.item_id === currentItem.id)?.answer === opt.id
                            ? "border-[#f59e0b] bg-[#f59e0b]"
                            : "border-slate-300"
                          }`}>
                            {answers.find(a => a.item_id === currentItem.id)?.answer === opt.id && <div className="h-2 w-2 bg-white rounded-full"></div>}
                          </div>
                          <span className="font-medium text-slate-700">{opt.text}</span>
                        </Label>
                      ))}
                    </RadioGroup>
                  ) : (
                    /* Textarea (EE/EO) */
                    <Textarea 
                      value={answers.find(a => a.item_id === currentItem.id)?.answer || ""}
                      onChange={(e) => handleAnswerChange(e.target.value)}
                      placeholder="Tapez votre réponse ici..."
                      className="min-h-[200px] text-lg p-6 border-slate-200 focus:border-[#f59e0b] focus:ring-[#f59e0b]"
                    />
                  )}
                </div>

                <div className="flex justify-end pt-4">
                  <Button 
                    disabled={!answers.find(a => a.item_id === currentItem.id)?.answer}
                    onClick={nextItem}
                    className="h-12 px-8 bg-[#0b234a] hover:bg-[#0b234a]/90 text-white font-bold"
                  >
                    Suivant
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Final Step: Submission */}
        {currentStep === 5 && (
          <Card className="border-none shadow-xl text-center p-20 space-y-6">
            <div className="h-20 w-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h2 className="text-3xl font-bold text-[#0b234a]">Test terminé !</h2>
            <p className="text-slate-500 max-w-md mx-auto">
              Vous avez répondu aux 24 questions. Cliquez sur le bouton ci-dessous pour valider vos réponses et voir votre bilan de niveau.
            </p>
            <Button 
              onClick={() => submitMutation.mutate({ 
                token, 
                student_name: studentName, 
                answers,
                source: 'app'
              })}
              disabled={submitMutation.isPending}
              className="h-14 px-12 bg-[#f59e0b] hover:bg-[#d97706] text-white font-bold text-lg rounded-xl"
            >
              {submitMutation.isPending ? "Analyse en cours..." : "Voir mes résultats"}
              <Send className="ml-2 h-5 w-5" />
            </Button>
          </Card>
        )}

      </div>
    </div>
  );
}

// Minimal Input component since I can't check all ui/ components
function Input({ ...props }: any) {
  return <input {...props} className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-amber-500 ${props.className}`} />
}
