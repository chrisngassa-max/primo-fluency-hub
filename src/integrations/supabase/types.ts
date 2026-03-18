export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      alertes: {
        Row: {
          created_at: string
          eleve_id: string
          formateur_id: string
          id: string
          is_read: boolean
          is_resolved: boolean
          message: string | null
          resolved_at: string | null
          type: Database["public"]["Enums"]["alerte_type"]
        }
        Insert: {
          created_at?: string
          eleve_id: string
          formateur_id: string
          id?: string
          is_read?: boolean
          is_resolved?: boolean
          message?: string | null
          resolved_at?: string | null
          type: Database["public"]["Enums"]["alerte_type"]
        }
        Update: {
          created_at?: string
          eleve_id?: string
          formateur_id?: string
          id?: string
          is_read?: boolean
          is_resolved?: boolean
          message?: string | null
          resolved_at?: string | null
          type?: Database["public"]["Enums"]["alerte_type"]
        }
        Relationships: [
          {
            foreignKeyName: "alertes_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertes_formateur_id_fkey"
            columns: ["formateur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      devoirs: {
        Row: {
          created_at: string
          date_echeance: string
          eleve_id: string
          exercice_id: string
          formateur_id: string
          id: string
          nb_reussites_consecutives: number
          raison: Database["public"]["Enums"]["devoir_raison"]
          statut: Database["public"]["Enums"]["devoir_statut"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_echeance?: string
          eleve_id: string
          exercice_id: string
          formateur_id: string
          id?: string
          nb_reussites_consecutives?: number
          raison?: Database["public"]["Enums"]["devoir_raison"]
          statut?: Database["public"]["Enums"]["devoir_statut"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_echeance?: string
          eleve_id?: string
          exercice_id?: string
          formateur_id?: string
          id?: string
          nb_reussites_consecutives?: number
          raison?: Database["public"]["Enums"]["devoir_raison"]
          statut?: Database["public"]["Enums"]["devoir_statut"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devoirs_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devoirs_exercice_id_fkey"
            columns: ["exercice_id"]
            isOneToOne: false
            referencedRelation: "exercices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devoirs_formateur_id_fkey"
            columns: ["formateur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      epreuves: {
        Row: {
          competence: Database["public"]["Enums"]["competence_type"]
          created_at: string
          description: string | null
          id: string
          nom: string
          ordre: number
        }
        Insert: {
          competence: Database["public"]["Enums"]["competence_type"]
          created_at?: string
          description?: string | null
          id?: string
          nom: string
          ordre?: number
        }
        Update: {
          competence?: Database["public"]["Enums"]["competence_type"]
          created_at?: string
          description?: string | null
          id?: string
          nom?: string
          ordre?: number
        }
        Relationships: []
      }
      exercices: {
        Row: {
          collectif: boolean
          competence: Database["public"]["Enums"]["competence_type"]
          consigne: string
          contenu: Json
          contexte_irn: string | null
          created_at: string
          difficulte: number
          eleve_id: string | null
          format: Database["public"]["Enums"]["exercice_format"]
          formateur_id: string
          id: string
          is_ai_generated: boolean
          is_devoir: boolean
          is_template: boolean
          mode: Database["public"]["Enums"]["exercice_mode"]
          niveau_vise: string
          point_a_maitriser_id: string
          sequence_id: string | null
          sous_competence: string | null
          titre: string
          updated_at: string
        }
        Insert: {
          collectif?: boolean
          competence: Database["public"]["Enums"]["competence_type"]
          consigne: string
          contenu?: Json
          contexte_irn?: string | null
          created_at?: string
          difficulte?: number
          eleve_id?: string | null
          format?: Database["public"]["Enums"]["exercice_format"]
          formateur_id: string
          id?: string
          is_ai_generated?: boolean
          is_devoir?: boolean
          is_template?: boolean
          mode?: Database["public"]["Enums"]["exercice_mode"]
          niveau_vise: string
          point_a_maitriser_id: string
          sequence_id?: string | null
          sous_competence?: string | null
          titre: string
          updated_at?: string
        }
        Update: {
          collectif?: boolean
          competence?: Database["public"]["Enums"]["competence_type"]
          consigne?: string
          contenu?: Json
          contexte_irn?: string | null
          created_at?: string
          difficulte?: number
          eleve_id?: string | null
          format?: Database["public"]["Enums"]["exercice_format"]
          formateur_id?: string
          id?: string
          is_ai_generated?: boolean
          is_devoir?: boolean
          is_template?: boolean
          mode?: Database["public"]["Enums"]["exercice_mode"]
          niveau_vise?: string
          point_a_maitriser_id?: string
          sequence_id?: string | null
          sous_competence?: string | null
          titre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercices_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercices_formateur_id_fkey"
            columns: ["formateur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercices_point_a_maitriser_id_fkey"
            columns: ["point_a_maitriser_id"]
            isOneToOne: false
            referencedRelation: "points_a_maitriser"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercices_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences_pedagogiques"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          eleve_id: string
          group_id: string
          id: string
          joined_at: string
        }
        Insert: {
          eleve_id: string
          group_id: string
          id?: string
          joined_at?: string
        }
        Update: {
          eleve_id?: string
          group_id?: string
          id?: string
          joined_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          description: string | null
          formateur_id: string
          id: string
          is_active: boolean
          niveau: string
          nom: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          formateur_id: string
          id?: string
          is_active?: boolean
          niveau: string
          nom: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          formateur_id?: string
          id?: string
          is_active?: boolean
          niveau?: string
          nom?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_formateur_id_fkey"
            columns: ["formateur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          titre: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          titre: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          titre?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parametres: {
        Row: {
          alerte_absence_heures: number
          auto_adapt: boolean
          created_at: string
          delai_devoirs_jours: number
          formateur_id: string
          id: string
          max_devoirs_actifs: number
          nb_reussites_consecutives: number
          seuil_acquis: number
          seuil_consolidation: number
          seuil_score_risque: number
          updated_at: string
        }
        Insert: {
          alerte_absence_heures?: number
          auto_adapt?: boolean
          created_at?: string
          delai_devoirs_jours?: number
          formateur_id: string
          id?: string
          max_devoirs_actifs?: number
          nb_reussites_consecutives?: number
          seuil_acquis?: number
          seuil_consolidation?: number
          seuil_score_risque?: number
          updated_at?: string
        }
        Update: {
          alerte_absence_heures?: number
          auto_adapt?: boolean
          created_at?: string
          delai_devoirs_jours?: number
          formateur_id?: string
          id?: string
          max_devoirs_actifs?: number
          nb_reussites_consecutives?: number
          seuil_acquis?: number
          seuil_consolidation?: number
          seuil_score_risque?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parametres_formateur_id_fkey"
            columns: ["formateur_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parcours: {
        Row: {
          created_at: string
          description: string | null
          formateur_id: string
          group_id: string | null
          heures_totales_prevues: number
          heures_totales_reelles: number
          id: string
          is_template: boolean
          nb_seances_prevues: number
          niveau_cible: string
          niveau_depart: string
          statut: string
          titre: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          formateur_id: string
          group_id?: string | null
          heures_totales_prevues?: number
          heures_totales_reelles?: number
          id?: string
          is_template?: boolean
          nb_seances_prevues?: number
          niveau_cible?: string
          niveau_depart?: string
          statut?: string
          titre: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          formateur_id?: string
          group_id?: string | null
          heures_totales_prevues?: number
          heures_totales_reelles?: number
          id?: string
          is_template?: boolean
          nb_seances_prevues?: number
          niveau_cible?: string
          niveau_depart?: string
          statut?: string
          titre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parcours_formateur_id_fkey"
            columns: ["formateur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcours_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      parcours_seances: {
        Row: {
          competences_cibles: string[]
          created_at: string
          duree_minutes: number
          exercices_faits: number | null
          exercices_total: number | null
          heures_reelles: number | null
          id: string
          nb_exercices_suggeres: number
          notes: string | null
          objectif_principal: string | null
          ordre: number
          parcours_id: string
          session_id: string | null
          statut: string
          titre: string
          updated_at: string
        }
        Insert: {
          competences_cibles?: string[]
          created_at?: string
          duree_minutes?: number
          exercices_faits?: number | null
          exercices_total?: number | null
          heures_reelles?: number | null
          id?: string
          nb_exercices_suggeres?: number
          notes?: string | null
          objectif_principal?: string | null
          ordre?: number
          parcours_id: string
          session_id?: string | null
          statut?: string
          titre: string
          updated_at?: string
        }
        Update: {
          competences_cibles?: string[]
          created_at?: string
          duree_minutes?: number
          exercices_faits?: number | null
          exercices_total?: number | null
          heures_reelles?: number | null
          id?: string
          nb_exercices_suggeres?: number
          notes?: string | null
          objectif_principal?: string | null
          ordre?: number
          parcours_id?: string
          session_id?: string | null
          statut?: string
          titre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parcours_seances_parcours_id_fkey"
            columns: ["parcours_id"]
            isOneToOne: false
            referencedRelation: "parcours"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcours_seances_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      points_a_maitriser: {
        Row: {
          created_at: string
          description: string | null
          id: string
          niveau_max: string
          niveau_min: string
          nom: string
          ordre: number
          sous_section_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          niveau_max: string
          niveau_min: string
          nom: string
          ordre?: number
          sous_section_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          niveau_max?: string
          niveau_min?: string
          nom?: string
          ordre?: number
          sous_section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_a_maitriser_sous_section_id_fkey"
            columns: ["sous_section_id"]
            isOneToOne: false
            referencedRelation: "sous_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          last_login: string | null
          mot_de_passe_initial: string | null
          nom: string
          prenom: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          is_active?: boolean
          last_login?: string | null
          mot_de_passe_initial?: string | null
          nom?: string
          prenom?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          last_login?: string | null
          mot_de_passe_initial?: string | null
          nom?: string
          prenom?: string
          updated_at?: string
        }
        Relationships: []
      }
      profils_eleves: {
        Row: {
          eleve_id: string
          id: string
          niveau_actuel: string
          priorites_pedagogiques: Json
          score_risque: number
          taux_reussite_ce: number
          taux_reussite_co: number
          taux_reussite_ee: number
          taux_reussite_eo: number
          taux_reussite_global: number
          taux_reussite_structures: number
          updated_at: string
        }
        Insert: {
          eleve_id: string
          id?: string
          niveau_actuel: string
          priorites_pedagogiques?: Json
          score_risque?: number
          taux_reussite_ce?: number
          taux_reussite_co?: number
          taux_reussite_ee?: number
          taux_reussite_eo?: number
          taux_reussite_global?: number
          taux_reussite_structures?: number
          updated_at?: string
        }
        Update: {
          eleve_id?: string
          id?: string
          niveau_actuel?: string
          priorites_pedagogiques?: Json
          score_risque?: number
          taux_reussite_ce?: number
          taux_reussite_co?: number
          taux_reussite_ee?: number
          taux_reussite_eo?: number
          taux_reussite_global?: number
          taux_reussite_structures?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profils_eleves_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      resultats: {
        Row: {
          correction_detaillee: Json
          created_at: string
          devoir_id: string | null
          eleve_id: string
          exercice_id: string
          id: string
          reponses_eleve: Json
          score: number
          tentative: number
        }
        Insert: {
          correction_detaillee?: Json
          created_at?: string
          devoir_id?: string | null
          eleve_id: string
          exercice_id: string
          id?: string
          reponses_eleve?: Json
          score: number
          tentative?: number
        }
        Update: {
          correction_detaillee?: Json
          created_at?: string
          devoir_id?: string | null
          eleve_id?: string
          exercice_id?: string
          id?: string
          reponses_eleve?: Json
          score?: number
          tentative?: number
        }
        Relationships: [
          {
            foreignKeyName: "resultats_devoir_id_fkey"
            columns: ["devoir_id"]
            isOneToOne: false
            referencedRelation: "devoirs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resultats_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resultats_exercice_id_fkey"
            columns: ["exercice_id"]
            isOneToOne: false
            referencedRelation: "exercices"
            referencedColumns: ["id"]
          },
        ]
      }
      sequences_pedagogiques: {
        Row: {
          created_at: string
          description: string | null
          formateur_id: string
          id: string
          is_ai_generated: boolean
          niveau: string
          titre: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          formateur_id: string
          id?: string
          is_ai_generated?: boolean
          niveau: string
          titre: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          formateur_id?: string
          id?: string
          is_ai_generated?: boolean
          niveau?: string
          titre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sequences_pedagogiques_formateur_id_fkey"
            columns: ["formateur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_exercices: {
        Row: {
          created_at: string
          exercice_id: string
          id: string
          notes: string | null
          ordre: number
          session_id: string
          statut: Database["public"]["Enums"]["session_exercice_statut"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          exercice_id: string
          id?: string
          notes?: string | null
          ordre?: number
          session_id: string
          statut?: Database["public"]["Enums"]["session_exercice_statut"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          exercice_id?: string
          id?: string
          notes?: string | null
          ordre?: number
          session_id?: string
          statut?: Database["public"]["Enums"]["session_exercice_statut"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_exercices_exercice_id_fkey"
            columns: ["exercice_id"]
            isOneToOne: false
            referencedRelation: "exercices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_exercices_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string
          date_seance: string
          duree_minutes: number
          group_id: string
          id: string
          lien_visio: string | null
          lieu: string | null
          niveau_cible: string
          objectifs: string | null
          statut: Database["public"]["Enums"]["session_statut"]
          titre: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_seance: string
          duree_minutes?: number
          group_id: string
          id?: string
          lien_visio?: string | null
          lieu?: string | null
          niveau_cible: string
          objectifs?: string | null
          statut?: Database["public"]["Enums"]["session_statut"]
          titre: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_seance?: string
          duree_minutes?: number
          group_id?: string
          id?: string
          lien_visio?: string | null
          lieu?: string | null
          niveau_cible?: string
          objectifs?: string | null
          statut?: Database["public"]["Enums"]["session_statut"]
          titre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      sous_sections: {
        Row: {
          created_at: string
          description: string | null
          epreuve_id: string
          id: string
          nom: string
          ordre: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          epreuve_id: string
          id?: string
          nom: string
          ordre?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          epreuve_id?: string
          id?: string
          nom?: string
          ordre?: number
        }
        Relationships: [
          {
            foreignKeyName: "sous_sections_epreuve_id_fkey"
            columns: ["epreuve_id"]
            isOneToOne: false
            referencedRelation: "epreuves"
            referencedColumns: ["id"]
          },
        ]
      }
      student_competency_status: {
        Row: {
          competence: Database["public"]["Enums"]["competence_type"]
          eleve_id: string
          id: string
          statut: Database["public"]["Enums"]["competence_statut"]
          updated_at: string
        }
        Insert: {
          competence: Database["public"]["Enums"]["competence_type"]
          eleve_id: string
          id?: string
          statut?: Database["public"]["Enums"]["competence_statut"]
          updated_at?: string
        }
        Update: {
          competence?: Database["public"]["Enums"]["competence_type"]
          eleve_id?: string
          id?: string
          statut?: Database["public"]["Enums"]["competence_statut"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_competency_status_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      test_entree_items: {
        Row: {
          competence: Database["public"]["Enums"]["competence_type"]
          contenu: Json
          created_at: string
          format: Database["public"]["Enums"]["exercice_format"]
          id: string
          niveau: string
          ordre: number
        }
        Insert: {
          competence: Database["public"]["Enums"]["competence_type"]
          contenu?: Json
          created_at?: string
          format?: Database["public"]["Enums"]["exercice_format"]
          id?: string
          niveau: string
          ordre?: number
        }
        Update: {
          competence?: Database["public"]["Enums"]["competence_type"]
          contenu?: Json
          created_at?: string
          format?: Database["public"]["Enums"]["exercice_format"]
          id?: string
          niveau?: string
          ordre?: number
        }
        Relationships: []
      }
      tests_entree: {
        Row: {
          completed_at: string | null
          derniere_question: number
          eleve_id: string
          en_cours: boolean
          id: string
          niveau_estime: string | null
          recommandations: string | null
          score_ce: number | null
          score_co: number | null
          score_ee: number | null
          score_global: number | null
          score_structures: number | null
          started_at: string
        }
        Insert: {
          completed_at?: string | null
          derniere_question?: number
          eleve_id: string
          en_cours?: boolean
          id?: string
          niveau_estime?: string | null
          recommandations?: string | null
          score_ce?: number | null
          score_co?: number | null
          score_ee?: number | null
          score_global?: number | null
          score_structures?: number | null
          started_at?: string
        }
        Update: {
          completed_at?: string | null
          derniere_question?: number
          eleve_id?: string
          en_cours?: boolean
          id?: string
          niveau_estime?: string | null
          recommandations?: string | null
          score_ce?: number | null
          score_co?: number | null
          score_ee?: number | null
          score_global?: number | null
          score_structures?: number | null
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tests_entree_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_group_formateur: { Args: { _group_id: string }; Returns: string }
      get_parcours_formateur: {
        Args: { _parcours_id: string }
        Returns: string
      }
      get_session_formateur: { Args: { _session_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      alerte_type:
        | "score_risque"
        | "absence"
        | "devoir_expire"
        | "tendance_baisse"
      app_role: "formateur" | "eleve" | "admin"
      competence_statut:
        | "non_evalue"
        | "non_acquis"
        | "consolide"
        | "acquis_provisoire"
      competence_type: "CO" | "CE" | "EE" | "EO" | "Structures"
      devoir_raison: "remediation" | "consolidation"
      devoir_statut: "en_attente" | "fait" | "expire" | "arrete"
      exercice_format:
        | "qcm"
        | "vrai_faux"
        | "appariement"
        | "production_ecrite"
        | "production_orale"
        | "texte_lacunaire"
        | "transformation"
      exercice_mode: "papier" | "en_ligne" | "les_deux"
      session_exercice_statut:
        | "planifie"
        | "traite_en_classe"
        | "reporte"
        | "devoir_remediation"
        | "devoir_anticipation"
      session_statut: "planifiee" | "en_cours" | "terminee" | "annulee"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      alerte_type: [
        "score_risque",
        "absence",
        "devoir_expire",
        "tendance_baisse",
      ],
      app_role: ["formateur", "eleve", "admin"],
      competence_statut: [
        "non_evalue",
        "non_acquis",
        "consolide",
        "acquis_provisoire",
      ],
      competence_type: ["CO", "CE", "EE", "EO", "Structures"],
      devoir_raison: ["remediation", "consolidation"],
      devoir_statut: ["en_attente", "fait", "expire", "arrete"],
      exercice_format: [
        "qcm",
        "vrai_faux",
        "appariement",
        "production_ecrite",
        "production_orale",
        "texte_lacunaire",
        "transformation",
      ],
      exercice_mode: ["papier", "en_ligne", "les_deux"],
      session_exercice_statut: [
        "planifie",
        "traite_en_classe",
        "reporte",
        "devoir_remediation",
        "devoir_anticipation",
      ],
      session_statut: ["planifiee", "en_cours", "terminee", "annulee"],
    },
  },
} as const
