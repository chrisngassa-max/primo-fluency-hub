import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function FormateurDashboardV2() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("seance");

  // (Mock pour la maquette)
  const nextSessionMock = {
    titre: "Préparation TCF CO",
    groupe: "Groupe A",
    horaire: "14:00 - 15:30",
    exercices: [
      { id: 1, title: "Exercice 1: Écoute active", type: "CO", done: false },
      { id: 2, title: "Exercice 2: Compréhension orale", type: "CO", done: false },
      { id: 3, title: "Exercice 3: Expression écrite", type: "EE", done: false },
      { id: 4, title: "Exercice 4: Expression orale", type: "EO", done: false },
    ]
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'CO': return 'bg-gradient-to-r from-purple-500 to-emerald-400 text-white border-0';
      case 'EE': return 'bg-gradient-to-r from-amber-700 to-amber-500 text-white border-0';
      case 'EO': return 'bg-gradient-to-r from-teal-500 to-emerald-400 text-white border-0';
      case 'CE': return 'bg-gradient-to-r from-blue-500 to-cyan-400 text-white border-0';
      default: return 'bg-primary text-primary-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 font-sans max-w-3xl mx-auto">
      
      {/* HEADER SECTION */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            Bonjour, {user?.user_metadata?.prenom ?? 'Claire'}
          </h1>
          <p className="text-foreground/80 mt-1 capitalize text-lg">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="bg-green-100 text-green-800 px-3 py-1.5 rounded-full flex items-center gap-2 text-sm font-semibold border border-green-200">
          Séance en cours
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
          </span>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="seance">Séance du jour</TabsTrigger>
          <TabsTrigger value="progression">Progression</TabsTrigger>
          <TabsTrigger value="alertes">Alertes</TabsTrigger>
        </TabsList>

        <TabsContent value="seance" className="space-y-4 outline-none mt-0">
          
          {/* Active Session Card */}
          <Card className="border-0 shadow-lg overflow-hidden bg-[#1E293B] text-white">
            <CardContent className="p-6">
              <h2 className="text-xl font-bold mb-2">
                Séance active: <span className="font-normal">{nextSessionMock.titre}</span>
              </h2>
              <p className="text-white/80 mb-1 font-medium">
                Group: <span className="font-normal">{nextSessionMock.groupe}</span>
              </p>
              <p className="text-white/80 mb-6 font-medium">
                Time: <span className="font-normal">{nextSessionMock.horaire}</span>
              </p>
              <Button className="w-full cap-orange-button h-12 text-lg">
                Piloter
              </Button>
            </CardContent>
          </Card>

          {/* Exercise List */}
          <div className="space-y-3 mt-6">
            {nextSessionMock.exercices.map((ex) => (
              <Card key={ex.id} className="border-0 shadow-sm overflow-hidden">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Checkbox id={`ex-${ex.id}`} className="h-5 w-5 rounded border-slate-300" />
                    <label htmlFor={`ex-${ex.id}`} className="text-base font-medium cursor-pointer">
                      {ex.title}
                    </label>
                  </div>
                  <Badge className={`px-3 py-1 rounded-lg ${getBadgeColor(ex.type)}`}>
                    {ex.type}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="pt-4">
            <Button className="w-full cap-orange-button h-14 text-lg">
              Générer des devoirs automatiques
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="progression" className="outline-none">
          <Card className="border-0 shadow-sm p-6">
            <h3 className="text-xl font-bold mb-4 text-primary">Aperçu de la progression</h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span>Compréhension Orale</span>
                  <span className="text-primary">68%</span>
                </div>
                <Progress value={68} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span>Compréhension Écrite</span>
                  <span className="text-primary">75%</span>
                </div>
                <Progress value={75} className="h-2" />
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="alertes" className="outline-none">
          <Card className="border-0 shadow-sm p-6 bg-rose-50">
            <h3 className="text-xl font-bold mb-4 text-rose-700">Alertes récentes</h3>
            <p className="text-rose-600/80">Aucune nouvelle alerte pour le moment.</p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
