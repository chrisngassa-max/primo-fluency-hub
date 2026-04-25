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
      activites_sauvegardees: {
        Row: {
          contenu_genere: Json
          created_at: string
          duree_minutes: number | null
          formateur_id: string
          id: string
          niveau: string | null
          seance_numero: number | null
          titre: string
          type_activite: string
        }
        Insert: {
          contenu_genere?: Json
          created_at?: string
          duree_minutes?: number | null
          formateur_id: string
          id?: string
          niveau?: string | null
          seance_numero?: number | null
          titre: string
          type_activite: string
        }
        Update: {
          contenu_genere?: Json
          created_at?: string
          duree_minutes?: number | null
          formateur_id?: string
          id?: string
          niveau?: string | null
          seance_numero?: number | null
          titre?: string
          type_activite?: string
        }
        Relationships: [
          {
            foreignKeyName: "activites_sauvegardees_formateur_id_fkey"
            columns: ["formateur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      analytics_events: {
        Row: {
          actor_id: string
          actor_type: string
          competence: string | null
          context: string | null
          created_at: string
          gabarit_id: string | null
          group_id: string | null
          id: string
          micro_competence_id: string | null
          object_id: string | null
          object_type: string | null
          result: Json | null
          seance_numero: number | null
          session_id: string | null
          source_app: string | null
          verb: string
        }
        Insert: {
          actor_id: string
          actor_type: string
          competence?: string | null
          context?: string | null
          created_at?: string
          gabarit_id?: string | null
          group_id?: string | null
          id?: string
          micro_competence_id?: string | null
          object_id?: string | null
          object_type?: string | null
          result?: Json | null
          seance_numero?: number | null
          session_id?: string | null
          source_app?: string | null
          verb: string
        }
        Update: {
          actor_id?: string
          actor_type?: string
          competence?: string | null
          context?: string | null
          created_at?: string
          gabarit_id?: string | null
          group_id?: string | null
          id?: string
          micro_competence_id?: string | null
          object_id?: string | null
          object_type?: string | null
          result?: Json | null
          seance_numero?: number | null
          session_id?: string | null
          source_app?: string | null
          verb?: string
        }
        Relationships: []
      }
      bilan_post_devoirs: {
        Row: {
          analyse_data: Json
          archived_at: string | null
          archived_reason: string | null
          created_at: string
          eleve_id: string
          formateur_id: string
          id: string
          is_integrated: boolean
          is_read: boolean
          session_id: string | null
        }
        Insert: {
          analyse_data?: Json
          archived_at?: string | null
          archived_reason?: string | null
          created_at?: string
          eleve_id: string
          formateur_id: string
          id?: string
          is_integrated?: boolean
          is_read?: boolean
          session_id?: string | null
        }
        Update: {
          analyse_data?: Json
          archived_at?: string | null
          archived_reason?: string | null
          created_at?: string
          eleve_id?: string
          formateur_id?: string
          id?: string
          is_integrated?: boolean
          is_read?: boolean
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bilan_post_devoirs_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bilan_post_devoirs_formateur_id_fkey"
            columns: ["formateur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bilan_post_devoirs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      bilan_test_results: {
        Row: {
          bilan_test_id: string
          correction: Json
          created_at: string
          eleve_id: string
          id: string
          reponses: Json
          score_global: number
          scores_par_competence: Json
        }
        Insert: {
          bilan_test_id: string
          correction?: Json
          created_at?: string
          eleve_id: string
          id?: string
          reponses?: Json
          score_global?: number
          scores_par_competence?: Json
        }
        Update: {
          bilan_test_id?: string
          correction?: Json
          created_at?: string
          eleve_id?: string
          id?: string
          reponses?: Json
          score_global?: number
          scores_par_competence?: Json
        }
        Relationships: [
          {
            foreignKeyName: "bilan_test_results_bilan_test_id_fkey"
            columns: ["bilan_test_id"]
            isOneToOne: false
            referencedRelation: "bilan_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bilan_test_results_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bilan_tests: {
        Row: {
          archived_at: string | null
          archived_reason: string | null
          competences_couvertes: string[]
          contenu: Json
          created_at: string
          formateur_id: string
          id: string
          nb_questions: number
          session_id: string
          statut: string
        }
        Insert: {
          archived_at?: string | null
          archived_reason?: string | null
          competences_couvertes?: string[]
          contenu?: Json
          created_at?: string
          formateur_id: string
          id?: string
          nb_questions?: number
          session_id: string
          statut?: string
        }
        Update: {
          archived_at?: string | null
          archived_reason?: string | null
          competences_couvertes?: string[]
          contenu?: Json
          created_at?: string
          formateur_id?: string
          id?: string
          nb_questions?: number
          session_id?: string
          statut?: string
        }
        Relationships: [
          {
            foreignKeyName: "bilan_tests_formateur_id_fkey"
            columns: ["formateur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bilan_tests_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      devoirs: {
        Row: {
          archived_at: string | null
          archived_reason: string | null
          contexte: string
          created_at: string
          date_echeance: string
          eleve_id: string
          exercice_id: string
          formateur_id: string
          id: string
          nb_reussites_consecutives: number
          raison: Database["public"]["Enums"]["devoir_raison"]
          serie: number | null
          session_id: string | null
          source_label: string | null
          statut: Database["public"]["Enums"]["devoir_statut"]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          archived_reason?: string | null
          contexte?: string
          created_at?: string
          date_echeance?: string
          eleve_id: string
          exercice_id: string
          formateur_id: string
          id?: string
          nb_reussites_consecutives?: number
          raison?: Database["public"]["Enums"]["devoir_raison"]
          serie?: number | null
          session_id?: string | null
          source_label?: string | null
          statut?: Database["public"]["Enums"]["devoir_statut"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          archived_reason?: string | null
          contexte?: string
          created_at?: string
          date_echeance?: string
          eleve_id?: string
          exercice_id?: string
          formateur_id?: string
          id?: string
          nb_reussites_consecutives?: number
          raison?: Database["public"]["Enums"]["devoir_raison"]
          serie?: number | null
          session_id?: string | null
          source_label?: string | null
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
          {
            foreignKeyName: "devoirs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_entree: {
        Row: {
          competence: string
          created_at: string
          eleve_id: string
          formateur_id: string
          id: string
          niveau_difficulte: number | null
          score: number
          sous_item: string
          updated_at: string
        }
        Insert: {
          competence: string
          created_at?: string
          eleve_id: string
          formateur_id: string
          id?: string
          niveau_difficulte?: number | null
          score?: number
          sous_item: string
          updated_at?: string
        }
        Update: {
          competence?: string
          created_at?: string
          eleve_id?: string
          formateur_id?: string
          id?: string
          niveau_difficulte?: number | null
          score?: number
          sous_item?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_entree_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_entree_formateur_id_fkey"
            columns: ["formateur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
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
          animation_guide: Json | null
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
          is_live_ready: boolean | null
          is_template: boolean
          mode: Database["public"]["Enums"]["exercice_mode"]
          niveau_vise: string
          play_token: string | null
          point_a_maitriser_id: string
          sequence_id: string | null
          source_url: string | null
          sous_competence: string | null
          statut: string | null
          titre: string
          updated_at: string
          variante_niveau_bas: Json | null
          variante_niveau_haut: Json | null
        }
        Insert: {
          animation_guide?: Json | null
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
          is_live_ready?: boolean | null
          is_template?: boolean
          mode?: Database["public"]["Enums"]["exercice_mode"]
          niveau_vise: string
          play_token?: string | null
          point_a_maitriser_id: string
          sequence_id?: string | null
          source_url?: string | null
          sous_competence?: string | null
          statut?: string | null
          titre: string
          updated_at?: string
          variante_niveau_bas?: Json | null
          variante_niveau_haut?: Json | null
        }
        Update: {
          animation_guide?: Json | null
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
          is_live_ready?: boolean | null
          is_template?: boolean
          mode?: Database["public"]["Enums"]["exercice_mode"]
          niveau_vise?: string
          play_token?: string | null
          point_a_maitriser_id?: string
          sequence_id?: string | null
          source_url?: string | null
          sous_competence?: string | null
          statut?: string | null
          titre?: string
          updated_at?: string
          variante_niveau_bas?: Json | null
          variante_niveau_haut?: Json | null
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
      exercise_assignments: {
        Row: {
          assigned_by: string | null
          context: string | null
          created_at: string | null
          due_date: string | null
          exercise_id: string | null
          group_id: string | null
          id: string
          learner_id: string | null
          source_devoir_id: string | null
          sync_status: string | null
        }
        Insert: {
          assigned_by?: string | null
          context?: string | null
          created_at?: string | null
          due_date?: string | null
          exercise_id?: string | null
          group_id?: string | null
          id?: string
          learner_id?: string | null
          source_devoir_id?: string | null
          sync_status?: string | null
        }
        Update: {
          assigned_by?: string | null
          context?: string | null
          created_at?: string | null
          due_date?: string | null
          exercise_id?: string | null
          group_id?: string | null
          id?: string
          learner_id?: string | null
          source_devoir_id?: string | null
          sync_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_assignments_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_assignments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_assignments_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_attempts: {
        Row: {
          answers: Json | null
          assignment_id: string | null
          completed_at: string | null
          created_at: string | null
          exercise_id: string | null
          feedback_text: string | null
          id: string
          item_results: Json | null
          learner_id: string | null
          score_normalized: number | null
          score_raw: number | null
          source_app: string | null
          source_resultat_id: string | null
          started_at: string | null
          status: string | null
          time_spent_seconds: number | null
        }
        Insert: {
          answers?: Json | null
          assignment_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          exercise_id?: string | null
          feedback_text?: string | null
          id?: string
          item_results?: Json | null
          learner_id?: string | null
          score_normalized?: number | null
          score_raw?: number | null
          source_app?: string | null
          source_resultat_id?: string | null
          started_at?: string | null
          status?: string | null
          time_spent_seconds?: number | null
        }
        Update: {
          answers?: Json | null
          assignment_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          exercise_id?: string | null
          feedback_text?: string | null
          id?: string
          item_results?: Json | null
          learner_id?: string | null
          score_normalized?: number | null
          score_raw?: number | null
          source_app?: string | null
          source_resultat_id?: string | null
          started_at?: string | null
          status?: string | null
          time_spent_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_attempts_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "exercise_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_attempts_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_attempts_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_reports: {
        Row: {
          bilan_test_id: string | null
          comment: string | null
          context: string
          created_at: string
          devoir_id: string | null
          eleve_id: string
          exercice_id: string | null
          formateur_id: string | null
          id: string
          item_index: number | null
          page_url: string | null
          resolved_at: string | null
          resolved_by: string | null
          screenshot_path: string | null
          status: string
          user_agent: string | null
        }
        Insert: {
          bilan_test_id?: string | null
          comment?: string | null
          context?: string
          created_at?: string
          devoir_id?: string | null
          eleve_id: string
          exercice_id?: string | null
          formateur_id?: string | null
          id?: string
          item_index?: number | null
          page_url?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          screenshot_path?: string | null
          status?: string
          user_agent?: string | null
        }
        Update: {
          bilan_test_id?: string | null
          comment?: string | null
          context?: string
          created_at?: string
          devoir_id?: string | null
          eleve_id?: string
          exercice_id?: string | null
          formateur_id?: string | null
          id?: string
          item_index?: number | null
          page_url?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          screenshot_path?: string | null
          status?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      external_resource_results: {
        Row: {
          comment: string | null
          created_at: string
          difficulty_felt: string | null
          external_resource_id: string
          id: string
          score: number | null
          screenshot_path: string | null
          source: string
          student_id: string
          time_spent_seconds: number | null
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          difficulty_felt?: string | null
          external_resource_id: string
          id?: string
          score?: number | null
          screenshot_path?: string | null
          source?: string
          student_id: string
          time_spent_seconds?: number | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          difficulty_felt?: string | null
          external_resource_id?: string
          id?: string
          score?: number | null
          screenshot_path?: string | null
          source?: string
          student_id?: string
          time_spent_seconds?: number | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_resource_results_external_resource_id_fkey"
            columns: ["external_resource_id"]
            isOneToOne: false
            referencedRelation: "external_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_resource_results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_resource_results_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      external_resources: {
        Row: {
          competence_id: string | null
          created_at: string
          created_by: string
          embed_type: string
          embeddable_checked_at: string | null
          embeddable_result: boolean | null
          id: string
          ordre: number | null
          provider: string
          session_id: string
          title: string
          url: string
        }
        Insert: {
          competence_id?: string | null
          created_at?: string
          created_by: string
          embed_type: string
          embeddable_checked_at?: string | null
          embeddable_result?: boolean | null
          id?: string
          ordre?: number | null
          provider?: string
          session_id: string
          title: string
          url: string
        }
        Update: {
          competence_id?: string | null
          created_at?: string
          created_by?: string
          embed_type?: string
          embeddable_checked_at?: string | null
          embeddable_result?: boolean | null
          id?: string
          ordre?: number | null
          provider?: string
          session_id?: string
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_resources_competence_id_fkey"
            columns: ["competence_id"]
            isOneToOne: false
            referencedRelation: "points_a_maitriser"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_resources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_resources_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      formateur_competences_config: {
        Row: {
          competences_ordonnees: Json
          formateur_id: string
          id: string
          seance_id: string
          updated_at: string
        }
        Insert: {
          competences_ordonnees?: Json
          formateur_id: string
          id?: string
          seance_id: string
          updated_at?: string
        }
        Update: {
          competences_ordonnees?: Json
          formateur_id?: string
          id?: string
          seance_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "formateur_competences_config_formateur_id_fkey"
            columns: ["formateur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gabarits_pedagogiques: {
        Row: {
          bloc: string | null
          competences_cibles: string[]
          consignes_generation: string | null
          created_at: string
          criteres_reussite: string | null
          dependances_seances: number[]
          id: string
          lexique_cibles: string[]
          niveau_cible: string | null
          numero: number
          objectif_principal: string | null
          palier_cecrl: string | null
          titre: string
        }
        Insert: {
          bloc?: string | null
          competences_cibles?: string[]
          consignes_generation?: string | null
          created_at?: string
          criteres_reussite?: string | null
          dependances_seances?: number[]
          id?: string
          lexique_cibles?: string[]
          niveau_cible?: string | null
          numero: number
          objectif_principal?: string | null
          palier_cecrl?: string | null
          titre: string
        }
        Update: {
          bloc?: string | null
          competences_cibles?: string[]
          consignes_generation?: string | null
          created_at?: string
          criteres_reussite?: string | null
          dependances_seances?: number[]
          id?: string
          lexique_cibles?: string[]
          niveau_cible?: string | null
          numero?: number
          objectif_principal?: string | null
          palier_cecrl?: string | null
          titre?: string
        }
        Relationships: []
      }
      group_invitations: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string
          group_id: string
          id: string
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at?: string
          group_id: string
          id?: string
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          group_id?: string
          id?: string
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "group_invitations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_invitations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
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
          type_demarche: string | null
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
          type_demarche?: string | null
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
          type_demarche?: string | null
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
          date_examen_cible: string | null
          description: string | null
          formateur_id: string
          group_id: string | null
          heures_totales_prevues: number
          heures_totales_reelles: number
          id: string
          is_template: boolean
          nb_seances_prevues: number
          nb_seances_realisees: number
          niveau_cible: string
          niveau_depart: string
          statut: string
          titre: string
          type_demarche: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_examen_cible?: string | null
          description?: string | null
          formateur_id: string
          group_id?: string | null
          heures_totales_prevues?: number
          heures_totales_reelles?: number
          id?: string
          is_template?: boolean
          nb_seances_prevues?: number
          nb_seances_realisees?: number
          niveau_cible?: string
          niveau_depart?: string
          statut?: string
          titre: string
          type_demarche?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_examen_cible?: string | null
          description?: string | null
          formateur_id?: string
          group_id?: string | null
          heures_totales_prevues?: number
          heures_totales_reelles?: number
          id?: string
          is_template?: boolean
          nb_seances_prevues?: number
          nb_seances_realisees?: number
          niveau_cible?: string
          niveau_depart?: string
          statut?: string
          titre?: string
          type_demarche?: string | null
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
      pedagogical_activities: {
        Row: {
          category: string | null
          competence: string | null
          created_at: string | null
          format: string | null
          id: string
          instructions: string | null
          is_active: boolean | null
          level_max: string | null
          level_min: string | null
          objective: string | null
          source: string | null
          tags: string[] | null
          title: string
        }
        Insert: {
          category?: string | null
          competence?: string | null
          created_at?: string | null
          format?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          level_max?: string | null
          level_min?: string | null
          objective?: string | null
          source?: string | null
          tags?: string[] | null
          title: string
        }
        Update: {
          category?: string | null
          competence?: string | null
          created_at?: string | null
          format?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          level_max?: string | null
          level_min?: string | null
          objective?: string | null
          source?: string | null
          tags?: string[] | null
          title?: string
        }
        Relationships: []
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
      presences: {
        Row: {
          commentaire: string | null
          created_at: string
          eleve_id: string
          id: string
          present: boolean
          session_id: string
          updated_at: string
        }
        Insert: {
          commentaire?: string | null
          created_at?: string
          eleve_id: string
          id?: string
          present?: boolean
          session_id: string
          updated_at?: string
        }
        Update: {
          commentaire?: string | null
          created_at?: string
          eleve_id?: string
          id?: string
          present?: boolean
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "presences_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presences_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
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
          status: string
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
          status?: string
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
          status?: string
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
          type_demarche: string | null
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
          type_demarche?: string | null
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
          type_demarche?: string | null
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
      resource_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string | null
          due_date: string | null
          group_id: string | null
          id: string
          learner_id: string | null
          resource_id: string | null
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string | null
          due_date?: string | null
          group_id?: string | null
          id?: string
          learner_id?: string | null
          resource_id?: string | null
        }
        Update: {
          assigned_by?: string | null
          created_at?: string | null
          due_date?: string | null
          group_id?: string | null
          id?: string
          learner_id?: string | null
          resource_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resource_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_assignments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_assignments_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_assignments_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "ressources_pedagogiques"
            referencedColumns: ["id"]
          },
        ]
      }
      ressources_pedagogiques: {
        Row: {
          competence: Database["public"]["Enums"]["competence_type"]
          contenu: Json
          created_at: string
          exercice_id: string | null
          formateur_id: string
          id: string
          niveau: string
          session_id: string | null
          source: Database["public"]["Enums"]["ressource_source"]
          statut: Database["public"]["Enums"]["ressource_statut"]
          titre: string
          type: Database["public"]["Enums"]["ressource_type"]
          updated_at: string
        }
        Insert: {
          competence: Database["public"]["Enums"]["competence_type"]
          contenu?: Json
          created_at?: string
          exercice_id?: string | null
          formateur_id: string
          id?: string
          niveau?: string
          session_id?: string | null
          source?: Database["public"]["Enums"]["ressource_source"]
          statut?: Database["public"]["Enums"]["ressource_statut"]
          titre: string
          type: Database["public"]["Enums"]["ressource_type"]
          updated_at?: string
        }
        Update: {
          competence?: Database["public"]["Enums"]["competence_type"]
          contenu?: Json
          created_at?: string
          exercice_id?: string | null
          formateur_id?: string
          id?: string
          niveau?: string
          session_id?: string | null
          source?: Database["public"]["Enums"]["ressource_source"]
          statut?: Database["public"]["Enums"]["ressource_statut"]
          titre?: string
          type?: Database["public"]["Enums"]["ressource_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ressources_pedagogiques_exercice_id_fkey"
            columns: ["exercice_id"]
            isOneToOne: false
            referencedRelation: "exercices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ressources_pedagogiques_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
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
          is_bonus: boolean
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
          is_bonus?: boolean
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
          is_bonus?: boolean
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
          is_public: boolean
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
          is_public?: boolean
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
          is_public?: boolean
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
          eleve_id: string | null
          exercice_id: string
          id: string
          is_bonus: boolean
          is_sent: boolean
          notes: string | null
          ordre: number
          session_id: string
          statut: Database["public"]["Enums"]["session_exercice_statut"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          eleve_id?: string | null
          exercice_id: string
          id?: string
          is_bonus?: boolean
          is_sent?: boolean
          notes?: string | null
          ordre?: number
          session_id: string
          statut?: Database["public"]["Enums"]["session_exercice_statut"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          eleve_id?: string | null
          exercice_id?: string
          id?: string
          is_bonus?: boolean
          is_sent?: boolean
          notes?: string | null
          ordre?: number
          session_id?: string
          statut?: Database["public"]["Enums"]["session_exercice_statut"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_exercices_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
      session_feedback: {
        Row: {
          commentaire_libre: string | null
          confiance: number
          created_at: string
          difficulte_percue: number
          eleve_id: string
          id: string
          session_id: string
          utilite_percue: number
        }
        Insert: {
          commentaire_libre?: string | null
          confiance: number
          created_at?: string
          difficulte_percue: number
          eleve_id: string
          id?: string
          session_id: string
          utilite_percue: number
        }
        Update: {
          commentaire_libre?: string | null
          confiance?: number
          created_at?: string
          difficulte_percue?: number
          eleve_id?: string
          id?: string
          session_id?: string
          utilite_percue?: number
        }
        Relationships: [
          {
            foreignKeyName: "session_feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          competences_cibles: string[] | null
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
          competences_cibles?: string[] | null
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
          competences_cibles?: string[] | null
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
      student_competency_levels: {
        Row: {
          competence: Database["public"]["Enums"]["competence_type"]
          created_at: string
          eleve_id: string
          id: string
          niveau_actuel: number
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          competence: Database["public"]["Enums"]["competence_type"]
          created_at?: string
          eleve_id: string
          id?: string
          niveau_actuel?: number
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          competence?: Database["public"]["Enums"]["competence_type"]
          created_at?: string
          eleve_id?: string
          id?: string
          niveau_actuel?: number
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_competency_levels_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_competency_levels_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      sync_log: {
        Row: {
          created_at: string | null
          direction: string | null
          error_message: string | null
          id: string
          payload: Json | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          direction?: string | null
          error_message?: string | null
          id?: string
          payload?: Json | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          direction?: string | null
          error_message?: string | null
          id?: string
          payload?: Json | null
          status?: string | null
        }
        Relationships: []
      }
      tcf_questions: {
        Row: {
          audio: string | null
          bonne_reponse: string
          choix: Json
          competence: string
          created_at: string
          enonce: string
          id: string
          palier: number
          type: string
          visual: string | null
        }
        Insert: {
          audio?: string | null
          bonne_reponse: string
          choix?: Json
          competence: string
          created_at?: string
          enonce: string
          id?: string
          palier?: number
          type?: string
          visual?: string | null
        }
        Update: {
          audio?: string | null
          bonne_reponse?: string
          choix?: Json
          competence?: string
          created_at?: string
          enonce?: string
          id?: string
          palier?: number
          type?: string
          visual?: string | null
        }
        Relationships: []
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
      test_questions: {
        Row: {
          choix_a: string | null
          choix_b: string | null
          choix_c: string | null
          competence: string
          consigne: string
          criteres_evaluation: Json | null
          id: string
          numero_dans_palier: number
          palier: number
          points_max: number | null
          reponse_correcte: string | null
          script_audio: string | null
          support: string | null
          type_reponse: string
        }
        Insert: {
          choix_a?: string | null
          choix_b?: string | null
          choix_c?: string | null
          competence: string
          consigne: string
          criteres_evaluation?: Json | null
          id?: string
          numero_dans_palier: number
          palier: number
          points_max?: number | null
          reponse_correcte?: string | null
          script_audio?: string | null
          support?: string | null
          type_reponse: string
        }
        Update: {
          choix_a?: string | null
          choix_b?: string | null
          choix_c?: string | null
          competence?: string
          consigne?: string
          criteres_evaluation?: Json | null
          id?: string
          numero_dans_palier?: number
          palier?: number
          points_max?: number | null
          reponse_correcte?: string | null
          script_audio?: string | null
          support?: string | null
          type_reponse?: string
        }
        Relationships: []
      }
      test_reponses: {
        Row: {
          competence: string
          date_reponse: string | null
          est_correct: boolean | null
          id: string
          justification_ia: string | null
          palier: number
          question_id: string
          reponse_apprenant: string | null
          reponse_audio_url: string | null
          score_formateur: number | null
          score_ia: number | null
          score_obtenu: number | null
          session_id: string
        }
        Insert: {
          competence: string
          date_reponse?: string | null
          est_correct?: boolean | null
          id?: string
          justification_ia?: string | null
          palier: number
          question_id: string
          reponse_apprenant?: string | null
          reponse_audio_url?: string | null
          score_formateur?: number | null
          score_ia?: number | null
          score_obtenu?: number | null
          session_id: string
        }
        Update: {
          competence?: string
          date_reponse?: string | null
          est_correct?: boolean | null
          id?: string
          justification_ia?: string | null
          palier?: number
          question_id?: string
          reponse_apprenant?: string | null
          reponse_audio_url?: string | null
          score_formateur?: number | null
          score_ia?: number | null
          score_obtenu?: number | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_reponses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "test_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_reponses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "test_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      test_resultats_apprenants: {
        Row: {
          apprenant_id: string
          date_test: string | null
          groupe_confirme: string | null
          groupe_suggere: string | null
          id: string
          palier_final_ce: number | null
          palier_final_co: number | null
          palier_final_ee: number | null
          palier_final_eo: number | null
          profil: string | null
          score_ce: number | null
          score_co: number | null
          score_ee: number | null
          score_eo: number | null
          score_total: number | null
          session_id: string
        }
        Insert: {
          apprenant_id: string
          date_test?: string | null
          groupe_confirme?: string | null
          groupe_suggere?: string | null
          id?: string
          palier_final_ce?: number | null
          palier_final_co?: number | null
          palier_final_ee?: number | null
          palier_final_eo?: number | null
          profil?: string | null
          score_ce?: number | null
          score_co?: number | null
          score_ee?: number | null
          score_eo?: number | null
          score_total?: number | null
          session_id: string
        }
        Update: {
          apprenant_id?: string
          date_test?: string | null
          groupe_confirme?: string | null
          groupe_suggere?: string | null
          id?: string
          palier_final_ce?: number | null
          palier_final_co?: number | null
          palier_final_ee?: number | null
          palier_final_eo?: number | null
          profil?: string | null
          score_ce?: number | null
          score_co?: number | null
          score_ee?: number | null
          score_eo?: number | null
          score_total?: number | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_resultats_apprenants_apprenant_id_fkey"
            columns: ["apprenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_resultats_apprenants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "test_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      test_sessions: {
        Row: {
          apprenant_id: string
          date_debut: string | null
          date_fin: string | null
          groupe_suggere: string | null
          groupe_valide_par_formateur: string | null
          id: string
          palier_ce: number | null
          palier_co: number | null
          palier_ee: number | null
          palier_eo: number | null
          profil_final: string | null
          score_ce: number | null
          score_co: number | null
          score_ee: number | null
          score_eo: number | null
          statut: string | null
        }
        Insert: {
          apprenant_id: string
          date_debut?: string | null
          date_fin?: string | null
          groupe_suggere?: string | null
          groupe_valide_par_formateur?: string | null
          id?: string
          palier_ce?: number | null
          palier_co?: number | null
          palier_ee?: number | null
          palier_eo?: number | null
          profil_final?: string | null
          score_ce?: number | null
          score_co?: number | null
          score_ee?: number | null
          score_eo?: number | null
          statut?: string | null
        }
        Update: {
          apprenant_id?: string
          date_debut?: string | null
          date_fin?: string | null
          groupe_suggere?: string | null
          groupe_valide_par_formateur?: string | null
          id?: string
          palier_ce?: number | null
          palier_co?: number | null
          palier_ee?: number | null
          palier_eo?: number | null
          profil_final?: string | null
          score_ce?: number | null
          score_co?: number | null
          score_ee?: number | null
          score_eo?: number | null
          statut?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_sessions_apprenant_id_fkey"
            columns: ["apprenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
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
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      update_priorites_pedagogiques: {
        Args: { p_eleve_id: string; p_nouvelle_priorite: string }
        Returns: undefined
      }
    }
    Enums: {
      alerte_type:
        | "score_risque"
        | "absence"
        | "devoir_expire"
        | "tendance_baisse"
        | "progression"
      app_role: "formateur" | "eleve" | "admin"
      competence_statut:
        | "non_evalue"
        | "non_acquis"
        | "consolide"
        | "acquis_provisoire"
      competence_type: "CO" | "CE" | "EE" | "EO" | "Structures"
      devoir_raison: "remediation" | "consolidation"
      devoir_statut: "en_attente" | "fait" | "expire" | "arrete" | "archive"
      exercice_format:
        | "qcm"
        | "vrai_faux"
        | "appariement"
        | "production_ecrite"
        | "production_orale"
        | "texte_lacunaire"
        | "transformation"
      exercice_mode: "papier" | "en_ligne" | "les_deux"
      ressource_source: "auto" | "manuel"
      ressource_statut: "draft" | "published"
      ressource_type:
        | "lecon"
        | "vocabulaire"
        | "rappel_methodo"
        | "rappel_visuel"
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
        "progression",
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
      devoir_statut: ["en_attente", "fait", "expire", "arrete", "archive"],
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
      ressource_source: ["auto", "manuel"],
      ressource_statut: ["draft", "published"],
      ressource_type: [
        "lecon",
        "vocabulaire",
        "rappel_methodo",
        "rappel_visuel",
      ],
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
