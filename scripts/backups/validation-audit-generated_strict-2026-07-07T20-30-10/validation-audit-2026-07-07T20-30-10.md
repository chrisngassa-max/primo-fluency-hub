# Audit validation Lot 9 — banque exercices

**Généré :** 2026-07-07T20:30:10.567Z
**Mode :** dry-run (0 écriture Supabase)
**Profil :** generated_strict
**Pipeline :** L1-L7-deterministic

## Métriques globales

| Métrique | Valeur |
|----------|--------|
| bank_total | 621 |
| validated_auto | 203 |
| needs_review | 49 |
| rejected | 369 |

## Top 20 codes d'issues

| Code | Occurrences |
|------|-------------|
| missing_ce_text | 374 |
| consigne_too_long_for_directives | 262 |
| correction_not_in_text | 226 |
| feedback_too_long | 222 |
| consigne_too_long | 208 |
| missing_audio_script | 164 |
| qcm_no_options | 100 |
| qcm_answer_not_in_options | 77 |
| ambiguous_correction | 38 |
| vf_invalid_answer | 16 |
| EXCL_02_format_competence | 13 |
| audio_script_too_long | 5 |
| item_no_answer | 2 |
| duration_volume_mismatch | 2 |

## Exercices rejected

- `001ebee8-60e8-4ee4-a991-55b4cb081f12` — (sans titre) — codes: correction_not_in_text
- `002136d5-072f-4a05-a876-476ab6ae62be` — (sans titre) — codes: correction_not_in_text
- `044e8dfc-1932-41b9-9907-00aff55b2c49` — (sans titre) — codes: missing_ce_text
- `05cf4f35-4df0-4e40-bcf4-13a6734689e7` — (sans titre) — codes: missing_ce_text
- `0f46fda3-8187-4766-a691-c0d207df7229` — (sans titre) — codes: qcm_answer_not_in_options, correction_not_in_text
- `14ee9ec2-09ac-4afa-ad86-27cc58dd5b59` — (sans titre) — codes: vf_invalid_answer
- `1c62a3f2-704c-4244-9473-b8bd51b40357` — (sans titre) — codes: qcm_answer_not_in_options, consigne_too_long_for_directives
- `2056fe03-a27e-4b7c-8f79-6be3d5d98049` — (sans titre) — codes: correction_not_in_text
- `20c09288-e717-46ec-ac5a-dbe84cdb7474` — (sans titre) — codes: missing_ce_text
- `28fadee8-fcd8-4a0a-9e0e-521d0ca13c13` — (sans titre) — codes: correction_not_in_text
- `b5d8b240-aa1d-4d97-a65e-182874ff18c3` — (sans titre) — codes: correction_not_in_text, ambiguous_correction
- `cf1c90a1-1a29-47ab-986b-6ed351b515ea` — (sans titre) — codes: item_no_answer, vf_invalid_answer
- `2a73237f-dc0f-42ba-9518-56d5aca549ff` — (sans titre) — codes: correction_not_in_text
- `2e6f7505-66a6-4c9b-bc8c-2126d1312bf2` — (sans titre) — codes: missing_ce_text
- `11c56ae4-0e09-46f5-9277-55bba1b3ec0b` — (sans titre) — codes: consigne_too_long, missing_ce_text, consigne_too_long_for_directives
- `b4417d9e-a8c6-45eb-8be2-5e8ed5abc3ab` — (sans titre) — codes: consigne_too_long, missing_ce_text, qcm_no_options, consigne_too_long_for_directives
- `4411731d-b178-4337-9790-c219be52b7a9` — (sans titre) — codes: consigne_too_long, missing_ce_text, EXCL_02_format_competence, consigne_too_long_for_directives
- `2758482c-8474-4de4-9b4a-24cc5ceeb09d` — (sans titre) — codes: consigne_too_long, missing_ce_text, EXCL_02_format_competence, consigne_too_long_for_directives
- `6388cb45-2648-42d4-b865-38bd5e2661d3` — (sans titre) — codes: missing_ce_text
- `5f6f5af1-f958-4261-9253-395ef0d1708a` — (sans titre) — codes: missing_ce_text
- `ce45893f-649e-4263-8d5f-8a4249466d07` — (sans titre) — codes: missing_ce_text, consigne_too_long_for_directives
- `767a328b-8524-49f9-96de-16e813a8ac00` — (sans titre) — codes: missing_ce_text
- `9032499c-4ede-487f-b042-78f73a95fc8d` — (sans titre) — codes: missing_ce_text
- `308bbe35-0a28-4331-b4e1-0f963767c210` — (sans titre) — codes: missing_ce_text
- `337c75a6-57c3-4781-941e-5577bee17a95` — (sans titre) — codes: missing_ce_text
- `351afd06-232a-432e-a350-369e86a89222` — (sans titre) — codes: missing_ce_text
- `35943339-9b4b-4c79-898a-92222ffba4bf` — (sans titre) — codes: qcm_no_options, correction_not_in_text
- `3c14cf30-971b-4a3b-9223-2421661baa5d` — (sans titre) — codes: consigne_too_long, consigne_too_long_for_directives, correction_not_in_text
- `46c9f54f-b743-4f45-9fa9-7fadc14445b8` — (sans titre) — codes: missing_ce_text
- `48c36037-aed8-4ff8-ae56-9833ff7f8c87` — (sans titre) — codes: consigne_too_long, consigne_too_long_for_directives, correction_not_in_text
- `49578246-3ebe-4030-9be7-f5f02778f2ef` — (sans titre) — codes: correction_not_in_text
- `4c983a50-bcce-4b70-b0bf-974c5cb211d5` — (sans titre) — codes: missing_audio_script
- `4d1ccf05-e02d-4670-a2c7-eb150156b2ce` — (sans titre) — codes: missing_ce_text
- `5641b192-2abd-41a3-a647-32f4cf6f124e` — (sans titre) — codes: missing_ce_text
- `565a89ca-4296-4690-81a3-8cf95466315a` — (sans titre) — codes: missing_ce_text
- `a81e8b89-4c30-4f64-ba59-0214838ed3a9` — (sans titre) — codes: correction_not_in_text
- `63c9ef6f-7e41-4995-be09-1642f9745547` — (sans titre) — codes: missing_ce_text
- `6630d88d-884f-46d0-8701-a8f9c522a697` — (sans titre) — codes: correction_not_in_text
- `67bad235-8d23-419a-bec8-cfccfeb1c01e` — (sans titre) — codes: correction_not_in_text
- `72f7ada0-214e-483a-a977-972210bc34de` — (sans titre) — codes: missing_ce_text
- `7b88f52f-3354-4d24-a969-173edefb95dc` — (sans titre) — codes: missing_ce_text
- `7d157417-f7af-485d-a427-934e942c5a79` — (sans titre) — codes: qcm_no_options, correction_not_in_text
- `dfe1ca1e-171f-4096-9c21-731c3135b757` — (sans titre) — codes: duration_volume_mismatch
- `a933ccc2-b1f3-4545-91df-4bdc6f8b1266` — (sans titre) — codes: audio_script_too_long, duration_volume_mismatch
- `7f7ee510-a579-423a-99f7-be0f93943fe3` — (sans titre) — codes: correction_not_in_text
- `00938c7c-55ee-4374-8069-34df987f5d90` — (sans titre) — codes: consigne_too_long, missing_ce_text, consigne_too_long_for_directives, feedback_too_long
- `00cf5938-6b24-41e1-a608-6ae2975b477d` — (sans titre) — codes: consigne_too_long, missing_ce_text, consigne_too_long_for_directives
- `0252ac11-48b3-4cd2-87be-43965f543b9e` — (sans titre) — codes: consigne_too_long, missing_ce_text, consigne_too_long_for_directives, feedback_too_long
- `06be5180-3260-43bd-9b97-b908a11f6a68` — (sans titre) — codes: consigne_too_long, missing_audio_script, consigne_too_long_for_directives
- `04876d7b-b1f0-4028-8b3d-1b9a05ef279f` — (sans titre) — codes: missing_ce_text
- `0bb81227-d5d1-44d9-a3f4-ccdc01ca7f70` — (sans titre) — codes: consigne_too_long, missing_ce_text, consigne_too_long_for_directives, feedback_too_long
- `0deb2039-d9fb-41f2-9206-44892352b926` — (sans titre) — codes: consigne_too_long, missing_ce_text, consigne_too_long_for_directives, feedback_too_long, ambiguous_correction
- `0eab511e-8524-4998-9bce-daf23aa5912d` — (sans titre) — codes: consigne_too_long, missing_ce_text, consigne_too_long_for_directives
- `101d1444-f6f5-406d-9855-459f5e6f62b0` — (sans titre) — codes: consigne_too_long, missing_ce_text, consigne_too_long_for_directives, feedback_too_long
- `12ede1af-823b-4284-a22b-777572c9e900` — (sans titre) — codes: consigne_too_long, missing_audio_script, consigne_too_long_for_directives, feedback_too_long
- `16b84216-88fc-4af1-b2ca-24bfef17058c` — (sans titre) — codes: correction_not_in_text
- `16ea8cbd-36a7-4131-90d1-a07f131e8541` — (sans titre) — codes: missing_audio_script, feedback_too_long, ambiguous_correction
- `1b4d279d-6552-4e01-8d9b-5c5d426ddc36` — (sans titre) — codes: missing_audio_script, consigne_too_long_for_directives, feedback_too_long
- `1b700ea1-2877-4569-8b55-2566a2d32873` — (sans titre) — codes: missing_ce_text, consigne_too_long_for_directives, feedback_too_long
- `1c66c72e-bbc0-4706-bcff-2f354059b2a3` — (sans titre) — codes: consigne_too_long, missing_ce_text, consigne_too_long_for_directives
- `1d2f5d47-4907-4d93-b19f-d0208a2cc092` — (sans titre) — codes: missing_ce_text
- `1e3ff1eb-0028-4284-97c8-357669d73a9c` — (sans titre) — codes: consigne_too_long, missing_audio_script, consigne_too_long_for_directives
- `287669a3-cdd1-44ca-99b1-fbeef461a945` — (sans titre) — codes: consigne_too_long, missing_ce_text, consigne_too_long_for_directives, feedback_too_long
- `23de6795-a188-4aa0-8e6c-034014f8b9d4` — (sans titre) — codes: missing_ce_text
- `294c2fc9-11f6-449a-b3ac-1dc65b491342` — (sans titre) — codes: consigne_too_long, missing_ce_text, consigne_too_long_for_directives, feedback_too_long
- `2b41a0f8-1e24-4f65-bfbc-9ef73218d1c1` — (sans titre) — codes: missing_audio_script, vf_invalid_answer
- `2ad89695-06f4-409c-8f6a-e9619a57622a` — (sans titre) — codes: missing_ce_text
- `2c67bae7-2b96-4c29-a1f7-58c5935d5858` — (sans titre) — codes: consigne_too_long, missing_audio_script, EXCL_02_format_competence, consigne_too_long_for_directives
- `3136af07-6d8a-41ea-8c34-7be16c843df8` — (sans titre) — codes: consigne_too_long, missing_audio_script, consigne_too_long_for_directives, feedback_too_long
- `3175ff5e-4499-454a-99fd-28eef5cd9737` — (sans titre) — codes: consigne_too_long, missing_ce_text, EXCL_02_format_competence, consigne_too_long_for_directives
- `33382dd4-67d1-4435-8d69-890ac3e0ced8` — (sans titre) — codes: missing_audio_script, consigne_too_long_for_directives, feedback_too_long
- `3ae5e71b-ccce-4af9-8d5b-ac16fd741b96` — (sans titre) — codes: consigne_too_long, missing_audio_script, consigne_too_long_for_directives, feedback_too_long
- `3b6511c4-c322-4e7b-8483-214023fde39f` — (sans titre) — codes: missing_ce_text, consigne_too_long_for_directives
- `3ea5f382-39ec-40eb-b2df-594f582e3eec` — (sans titre) — codes: consigne_too_long, missing_audio_script, consigne_too_long_for_directives
- `47428015-9cb3-441f-bcb6-83e53280fc83` — (sans titre) — codes: consigne_too_long, missing_ce_text, consigne_too_long_for_directives, feedback_too_long
- `4e705121-1d63-450b-a632-d94d8c3e6bbf` — (sans titre) — codes: missing_ce_text
- `50c9d01d-3c79-4de0-bf58-b7fc1784b0fe` — (sans titre) — codes: consigne_too_long, missing_audio_script, consigne_too_long_for_directives, feedback_too_long
- `51ca0951-1392-4399-b554-d94ad7f63fcb` — (sans titre) — codes: consigne_too_long, missing_audio_script, consigne_too_long_for_directives
- `5448c46f-27cb-4add-8c67-9b3e4953d05c` — (sans titre) — codes: consigne_too_long, missing_audio_script, consigne_too_long_for_directives, feedback_too_long
- `556cba0c-d037-4684-8ada-a5c2e97f6e52` — (sans titre) — codes: consigne_too_long, missing_audio_script, consigne_too_long_for_directives
- `569692e7-5f18-4daf-b2d5-ae3c2deb7136` — (sans titre) — codes: consigne_too_long, missing_ce_text, consigne_too_long_for_directives
- `56f7b922-0175-462a-b3ee-30cb8503a6d5` — (sans titre) — codes: missing_ce_text, feedback_too_long
- `5b456fc4-770a-42eb-9488-791d3b190301` — (sans titre) — codes: consigne_too_long, missing_ce_text, consigne_too_long_for_directives
- `5e1834e3-b2d9-472e-977c-42774a8437d9` — (sans titre) — codes: consigne_too_long, missing_audio_script, consigne_too_long_for_directives, feedback_too_long, ambiguous_correction
- `5fbf1e86-0ac2-48d2-9872-654fbda528a9` — (sans titre) — codes: consigne_too_long, missing_ce_text, consigne_too_long_for_directives, feedback_too_long
- `6086f4fe-efaa-474c-81e5-860b9d91f1af` — (sans titre) — codes: consigne_too_long, missing_ce_text, consigne_too_long_for_directives, feedback_too_long
- `647fc278-effa-42c7-824e-ad72ad58cfb7` — (sans titre) — codes: consigne_too_long, missing_ce_text, consigne_too_long_for_directives
- `6ea666fe-708e-4535-ac03-11f4031b630d` — (sans titre) — codes: missing_ce_text, consigne_too_long_for_directives, feedback_too_long
- `73fa072e-8136-4552-ab8e-9f38de873464` — (sans titre) — codes: missing_audio_script, consigne_too_long_for_directives, ambiguous_correction
- `75a37690-33fd-428c-90a7-8a00a304653f` — (sans titre) — codes: consigne_too_long, missing_ce_text, consigne_too_long_for_directives, feedback_too_long
- `7a05e456-ad16-4a90-8669-8ff3947e90f9` — (sans titre) — codes: missing_audio_script, consigne_too_long_for_directives
- `1e3e0f5b-7947-4a93-9db2-0fd992d489be` — (sans titre) — codes: missing_audio_script
- `7c0b20c1-4f66-42da-9d9b-3ec3212601de` — (sans titre) — codes: consigne_too_long, missing_ce_text, consigne_too_long_for_directives, feedback_too_long
- `8706c89a-6c4e-4cbf-afa1-4fa166549c72` — (sans titre) — codes: consigne_too_long, missing_ce_text, consigne_too_long_for_directives, feedback_too_long
- `8a5bea91-eaac-4404-9c1d-14e97993da07` — (sans titre) — codes: EXCL_02_format_competence, consigne_too_long_for_directives
- `8c4a82ee-81c2-46db-af6f-415ed6d08d08` — (sans titre) — codes: consigne_too_long, missing_audio_script, consigne_too_long_for_directives, feedback_too_long
- `8c4e55c6-b631-4caa-8957-a0b988658588` — (sans titre) — codes: consigne_too_long, missing_ce_text, EXCL_02_format_competence, consigne_too_long_for_directives
- `8dc40198-db88-4da4-99df-993a5153754b` — (sans titre) — codes: consigne_too_long, missing_audio_script, consigne_too_long_for_directives, feedback_too_long
- `8f75baab-153b-40ed-8bb6-a501c3894e55` — (sans titre) — codes: missing_ce_text, consigne_too_long_for_directives, feedback_too_long
- `8f900054-b82a-4ab5-a4cc-fe900fd04536` — (sans titre) — codes: consigne_too_long, missing_ce_text, consigne_too_long_for_directives, feedback_too_long

_… et 269 autres._

## Exercices needs_review (flags)

- `136a1d26-05f6-40b9-acbc-f9871268f0f3` — (sans titre) — flags: —
- `19f7c554-5870-4d0d-a57d-287d868ac6bc` — (sans titre) — flags: sensitive_admin
- `2610eaab-bdc1-4d18-8218-e973ec811e7a` — (sans titre) — flags: sensitive_admin
- `2b21e3a7-e119-44ec-8a15-cd03f5f66318` — (sans titre) — flags: sensitive_admin
- `504cefdb-14f2-4cd1-8688-6f923c9f3ad6` — (sans titre) — flags: sensitive_admin
- `60ed11de-5b5f-402d-a138-f4ec319182c9` — (sans titre) — flags: —
- `e3457a11-542c-4176-9a32-6aad37a2d361` — (sans titre) — flags: —
- `7de22aa0-7629-4419-9537-fdebc99d6fdb` — (sans titre) — flags: sensitive_admin
- `05916d9e-88b0-49c2-bf48-e6c00024feb7` — (sans titre) — flags: sensitive_admin
- `0715eab7-ba83-4f1e-b45c-740921a77064` — (sans titre) — flags: sensitive_admin
- `08dba933-a757-4a41-8832-68ad9ad93291` — (sans titre) — flags: sensitive_admin
- `3fc86172-1c36-4758-8389-aa915aa707a5` — (sans titre) — flags: sensitive_admin
- `45fa9050-1fd5-40e8-a1f8-ee36c9d89af1` — (sans titre) — flags: sensitive_admin
- `5c5cf93f-9e2f-4f5b-8f56-71ee1a100b73` — (sans titre) — flags: sensitive_admin
- `6044d100-9342-4c6e-a917-612563e4a186` — (sans titre) — flags: sensitive_admin
- `66cdf013-b5b3-43eb-9d00-7286fab638de` — (sans titre) — flags: sensitive_admin
- `679a2446-7738-4839-ad55-8cbd847d3e25` — (sans titre) — flags: sensitive_admin
- `6c653288-b698-4ae3-b379-3d05b0095f52` — (sans titre) — flags: sensitive_admin
- `762d466c-0b38-4ca9-8d1a-baf1f9985258` — (sans titre) — flags: sensitive_admin
- `7f6582eb-1415-4976-8a33-b4ed3d8ffae8` — (sans titre) — flags: sensitive_admin
- `82cc5547-bcae-422c-8fd3-87eecb0d1ad3` — (sans titre) — flags: sensitive_admin
- `99d30e6b-ecec-4b7d-ac1e-3c73f93ab9de` — (sans titre) — flags: sensitive_admin
- `a2ca2b7e-2abb-49e8-8e56-2e6e73691057` — (sans titre) — flags: sensitive_admin
- `a2ccca6d-e787-4e0b-88cb-db71d8758b2b` — (sans titre) — flags: sensitive_admin
- `a7907e6f-772c-4c9d-b4c3-4ac624294cb4` — (sans titre) — flags: —
- `b6f344b4-4f6b-42cc-b2a2-b0923c7f0e04` — (sans titre) — flags: sensitive_admin
- `b7ae4a07-26bd-4cc3-88a8-67d878148b00` — (sans titre) — flags: sensitive_admin
- `c17b0261-3550-42a8-ae3b-5a87bf2cc136` — (sans titre) — flags: sensitive_admin
- `df7d9aea-05b9-4fec-b226-8291a458f5cb` — (sans titre) — flags: sensitive_admin
- `e13e5a70-8488-4694-89b1-60564d24bb36` — (sans titre) — flags: sensitive_admin
- `ec131424-6579-4ebb-ad2d-6b99cba0fac2` — (sans titre) — flags: sensitive_admin
- `f85f0f0b-f1bd-4871-b16a-1ad700aa4eda` — (sans titre) — flags: sensitive_admin
- `1013a938-83ec-4fcb-8772-160416d3a1d9` — (sans titre) — flags: sensitive_admin
- `9f207a0a-3fb5-426b-9800-8e6891abb578` — (sans titre) — flags: —
- `c751c736-9b16-4c78-9d7c-1795fb5b7ae3` — (sans titre) — flags: sensitive_admin
- `c7a2d9f2-0f88-4bf6-b184-10da1e34a8b8` — (sans titre) — flags: sensitive_admin
- `fa0227c3-29db-4a4a-a9ee-012ea1c04f4d` — (sans titre) — flags: —
- `e63b03e3-0c98-4cbf-a5a5-a29777ec507c` — (sans titre) — flags: —
- `19a3f6b2-58ae-428e-b9d8-fa6ffdfaec2f` — (sans titre) — flags: —
- `8724f34d-c44b-42ec-86f9-d95a93ebdb25` — (sans titre) — flags: sensitive_admin
- `7b57c0de-c501-48c4-b6c4-ef3237594722` — (sans titre) — flags: —
- `49ba6ff0-6fcd-4f26-8632-871673324d76` — (sans titre) — flags: —
- `bd8567cc-537a-473a-8222-dccf282df37d` — (sans titre) — flags: —
- `6920b3df-0954-4af1-ab2e-9c0eba62940f` — (sans titre) — flags: —
- `52ed3238-4241-4e09-b77e-06cf9c45ab8f` — (sans titre) — flags: sensitive_admin
- `6a5b78b0-cc88-491e-9973-53cd80902ba4` — (sans titre) — flags: —
- `2fd6e194-a15f-495c-b33f-adbf7d6d36ce` — (sans titre) — flags: sensitive_admin
- `31c0a3c0-b38b-4a73-a4cb-dfe9c43d8679` — (sans titre) — flags: sensitive_admin
- `1da3b156-3210-4db1-8001-ff3030e65163` — (sans titre) — flags: sensitive_admin

## Annexe — doublons metadata_code

_Aucun doublon._

## Annexe — incohérences format/compétence connues (dette Lot 8)

Total : **13** (non corrigées en Lot 9).

| id | metadata_code | competence | format | titre |
|----|---------------|------------|--------|-------|
| 4411731d-b178-4337-9790-c219be52b7a9 | cv2:S01:variant:B1 | CE | production_ecrite | S01 · variante B1 |
| 2758482c-8474-4de4-9b4a-24cc5ceeb09d | cv2:S01:variant:B2 | CE | production_ecrite | S01 · variante B2 |
| 2c67bae7-2b96-4c29-a1f7-58c5935d5858 |  | CO | production_ecrite | Rédiger un courrier à la CAF concernant  |
| 3175ff5e-4499-454a-99fd-28eef5cd9737 |  | CE | production_orale | Dialoguer avec un médecin - Production o |
| 8a5bea91-eaac-4404-9c1d-14e97993da07 |  | EO | appariement | Appariement vocabulaire travail - Défini |
| 8c4e55c6-b631-4caa-8957-a0b988658588 |  | CE | production_ecrite | Production écrite - Demande de rendez-vo |
| dbcd89c9-1140-48fc-857b-4921d53a72f8 |  | CE | production_ecrite | Répondre à une invitation pour une activ |
| ffffe409-af1e-42f0-bd49-d3dc5dbf6036 |  | CO | production_orale | S'installer dans un logement - Productio |
| 943f21a7-9786-4bdc-803e-1a9e1599569c |  | EE | appariement | Catégories d'identité |
| f411b6b7-539a-4bd0-9a15-279b83ed84a2 |  | CE | production_ecrite | Inscription au sport municipal |
| f806b0d2-b3a8-443a-af28-8647e1ee8d28 |  | CE | production_orale | Le contrôle d'identité oral |
| c9913d4a-d2ab-4272-b80d-08f1df63ffc9 |  | EE | vrai_faux | Comprendre une carte de bibliothèque |
| 6a432366-93b8-47ff-aa0b-98562833332a |  | CE | production_ecrite | Production écrite - Raconter un souvenir |

---
_Rapport généré par scripts/audit-exercices-validation.mjs — Lot 9 socle dry-run._