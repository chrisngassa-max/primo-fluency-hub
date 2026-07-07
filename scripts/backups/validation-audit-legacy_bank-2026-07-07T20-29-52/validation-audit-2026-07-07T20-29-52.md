# Audit validation Lot 9 — banque exercices

**Généré :** 2026-07-07T20:29:52.662Z
**Mode :** dry-run (0 écriture Supabase)
**Profil :** legacy_bank
**Pipeline :** L1-L7-deterministic

## Métriques globales

| Métrique | Valeur |
|----------|--------|
| bank_total | 621 |
| validated_auto | 372 |
| needs_review | 198 |
| rejected | 51 |

## Top 20 codes d'issues

| Code | Occurrences |
|------|-------------|
| consigne_too_long_for_directives | 262 |
| correction_not_in_text | 226 |
| feedback_too_long | 222 |
| consigne_too_long | 208 |
| missing_ce_text | 187 |
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

- `0f46fda3-8187-4766-a691-c0d207df7229` — (sans titre) — codes: qcm_answer_not_in_options, correction_not_in_text
- `14ee9ec2-09ac-4afa-ad86-27cc58dd5b59` — (sans titre) — codes: vf_invalid_answer
- `1c62a3f2-704c-4244-9473-b8bd51b40357` — (sans titre) — codes: qcm_answer_not_in_options, consigne_too_long_for_directives
- `cf1c90a1-1a29-47ab-986b-6ed351b515ea` — (sans titre) — codes: item_no_answer, vf_invalid_answer
- `b4417d9e-a8c6-45eb-8be2-5e8ed5abc3ab` — (sans titre) — codes: consigne_too_long, qcm_no_options, consigne_too_long_for_directives, missing_ce_text
- `4411731d-b178-4337-9790-c219be52b7a9` — (sans titre) — codes: consigne_too_long, EXCL_02_format_competence, consigne_too_long_for_directives, missing_ce_text
- `2758482c-8474-4de4-9b4a-24cc5ceeb09d` — (sans titre) — codes: consigne_too_long, EXCL_02_format_competence, consigne_too_long_for_directives, missing_ce_text
- `35943339-9b4b-4c79-898a-92222ffba4bf` — (sans titre) — codes: qcm_no_options, correction_not_in_text
- `7d157417-f7af-485d-a427-934e942c5a79` — (sans titre) — codes: qcm_no_options, correction_not_in_text
- `dfe1ca1e-171f-4096-9c21-731c3135b757` — (sans titre) — codes: duration_volume_mismatch
- `a933ccc2-b1f3-4545-91df-4bdc6f8b1266` — (sans titre) — codes: audio_script_too_long, duration_volume_mismatch
- `2b41a0f8-1e24-4f65-bfbc-9ef73218d1c1` — (sans titre) — codes: missing_audio_script, vf_invalid_answer
- `2c67bae7-2b96-4c29-a1f7-58c5935d5858` — (sans titre) — codes: consigne_too_long, missing_audio_script, EXCL_02_format_competence, consigne_too_long_for_directives
- `3175ff5e-4499-454a-99fd-28eef5cd9737` — (sans titre) — codes: consigne_too_long, EXCL_02_format_competence, consigne_too_long_for_directives, missing_ce_text
- `8a5bea91-eaac-4404-9c1d-14e97993da07` — (sans titre) — codes: EXCL_02_format_competence, consigne_too_long_for_directives
- `8c4e55c6-b631-4caa-8957-a0b988658588` — (sans titre) — codes: consigne_too_long, EXCL_02_format_competence, consigne_too_long_for_directives, missing_ce_text
- `a980aa48-05cb-4ed9-b901-e477870dc7a4` — (sans titre) — codes: missing_audio_script, qcm_answer_not_in_options, consigne_too_long_for_directives, feedback_too_long
- `dbcd89c9-1140-48fc-857b-4921d53a72f8` — (sans titre) — codes: consigne_too_long, EXCL_02_format_competence, consigne_too_long_for_directives, missing_ce_text
- `ffffe409-af1e-42f0-bd49-d3dc5dbf6036` — (sans titre) — codes: consigne_too_long, missing_audio_script, EXCL_02_format_competence, consigne_too_long_for_directives
- `923047ad-9735-4436-a34a-13eca7b6cd8d` — (sans titre) — codes: vf_invalid_answer, consigne_too_long_for_directives
- `943f21a7-9786-4bdc-803e-1a9e1599569c` — (sans titre) — codes: EXCL_02_format_competence
- `9db3c203-0446-4f17-8eac-9cc1dc74b16e` — (sans titre) — codes: qcm_no_options, correction_not_in_text
- `aa43d22d-968a-4865-8271-e87613cc3d8b` — (sans titre) — codes: qcm_no_options, qcm_answer_not_in_options, consigne_too_long_for_directives, correction_not_in_text
- `bb5efbe9-1eb2-4630-9b74-7f5da7dde7dc` — (sans titre) — codes: consigne_too_long, qcm_no_options, consigne_too_long_for_directives, correction_not_in_text
- `bbcbcbbf-0ce3-4922-bdbf-5026eafb7f5f` — (sans titre) — codes: qcm_no_options, correction_not_in_text
- `cc17e5c7-7cf3-4a92-8234-4c803df9286b` — (sans titre) — codes: qcm_no_options, correction_not_in_text
- `f411b6b7-539a-4bd0-9a15-279b83ed84a2` — (sans titre) — codes: consigne_too_long, EXCL_02_format_competence, consigne_too_long_for_directives
- `e3d7d31e-99f1-45a8-a052-d06219828d97` — (sans titre) — codes: qcm_answer_not_in_options
- `406d8725-87af-4f51-a5e4-824a68f64727` — (sans titre) — codes: missing_audio_script, qcm_no_options
- `0904ec17-9b03-465a-9c3f-bd7d53dbd26b` — (sans titre) — codes: item_no_answer, qcm_answer_not_in_options, missing_ce_text
- `41a5dd63-8128-4a47-9c2d-c7b3df3737f8` — (sans titre) — codes: qcm_answer_not_in_options, missing_ce_text
- `92f95bfe-c820-42ee-af6d-2adf3f3bcc84` — (sans titre) — codes: qcm_no_options, qcm_answer_not_in_options, correction_not_in_text
- `95ec5ce9-7464-423b-a42d-049ddb8d5dc8` — (sans titre) — codes: qcm_answer_not_in_options, correction_not_in_text
- `eefa6ec4-75d2-45fb-9e46-4c1a3b9e90c7` — (sans titre) — codes: qcm_no_options, correction_not_in_text
- `8d831309-6bbb-4c7e-925c-81f739c7b17c` — (sans titre) — codes: qcm_no_options
- `64235e77-1d1f-4847-ac1a-e304317de09a` — (sans titre) — codes: qcm_no_options
- `d5583da1-ca3a-4a73-8e2c-bd2817a0d1b9` — (sans titre) — codes: qcm_answer_not_in_options, correction_not_in_text
- `ae3a684a-c59e-447d-95b7-c06aed8e313b` — (sans titre) — codes: qcm_answer_not_in_options, correction_not_in_text
- `3b63dbcc-0728-4525-8400-020c82ba2a54` — (sans titre) — codes: qcm_answer_not_in_options, correction_not_in_text, ambiguous_correction
- `51e646a1-9def-4c49-b2bd-24ffff5e88d0` — (sans titre) — codes: qcm_answer_not_in_options, correction_not_in_text
- `447a90bf-651e-41eb-ac4a-84e45a7ac5b9` — (sans titre) — codes: qcm_answer_not_in_options, consigne_too_long_for_directives, correction_not_in_text
- `a851d971-44b5-43f9-9a1d-6c20bbc4fd9f` — (sans titre) — codes: qcm_no_options, qcm_answer_not_in_options, correction_not_in_text
- `f806b0d2-b3a8-443a-af28-8647e1ee8d28` — (sans titre) — codes: EXCL_02_format_competence, missing_ce_text
- `e50f3fbe-ac39-4a0a-baf3-913c428fb22a` — (sans titre) — codes: missing_audio_script, qcm_no_options
- `c9913d4a-d2ab-4272-b80d-08f1df63ffc9` — (sans titre) — codes: consigne_too_long, EXCL_02_format_competence, consigne_too_long_for_directives
- `53db0da7-1947-4bac-967d-045676b6de79` — (sans titre) — codes: qcm_no_options, correction_not_in_text
- `2d4f5509-028d-4dad-81c4-0b53790a9240` — (sans titre) — codes: qcm_no_options
- `2c3fe13d-b67c-470b-b24b-7be5a0240c1f` — (sans titre) — codes: qcm_answer_not_in_options, feedback_too_long
- `6a432366-93b8-47ff-aa0b-98562833332a` — (sans titre) — codes: consigne_too_long, EXCL_02_format_competence, consigne_too_long_for_directives, missing_ce_text
- `b153c25f-7a37-407f-82fc-06198ca9adf3` — (sans titre) — codes: consigne_too_long, qcm_answer_not_in_options, consigne_too_long_for_directives, missing_ce_text
- `50b4f7da-646c-4f51-a88b-b5d269ff1e63` — (sans titre) — codes: consigne_too_long, missing_audio_script, vf_invalid_answer, consigne_too_long_for_directives, feedback_too_long

## Exercices needs_review (flags)

- `136a1d26-05f6-40b9-acbc-f9871268f0f3` — (sans titre) — flags: —
- `19f7c554-5870-4d0d-a57d-287d868ac6bc` — (sans titre) — flags: sensitive_admin
- `2610eaab-bdc1-4d18-8218-e973ec811e7a` — (sans titre) — flags: sensitive_admin
- `b5d8b240-aa1d-4d97-a65e-182874ff18c3` — (sans titre) — flags: —
- `2b21e3a7-e119-44ec-8a15-cd03f5f66318` — (sans titre) — flags: sensitive_admin
- `11c56ae4-0e09-46f5-9277-55bba1b3ec0b` — (sans titre) — flags: —
- `ce45893f-649e-4263-8d5f-8a4249466d07` — (sans titre) — flags: sensitive_admin
- `3c14cf30-971b-4a3b-9223-2421661baa5d` — (sans titre) — flags: —
- `48c36037-aed8-4ff8-ae56-9833ff7f8c87` — (sans titre) — flags: sensitive_admin
- `504cefdb-14f2-4cd1-8688-6f923c9f3ad6` — (sans titre) — flags: sensitive_admin
- `60ed11de-5b5f-402d-a138-f4ec319182c9` — (sans titre) — flags: —
- `e3457a11-542c-4176-9a32-6aad37a2d361` — (sans titre) — flags: —
- `7de22aa0-7629-4419-9537-fdebc99d6fdb` — (sans titre) — flags: sensitive_admin
- `00938c7c-55ee-4374-8069-34df987f5d90` — (sans titre) — flags: —
- `00cf5938-6b24-41e1-a608-6ae2975b477d` — (sans titre) — flags: sensitive_admin
- `0252ac11-48b3-4cd2-87be-43965f543b9e` — (sans titre) — flags: —
- `05916d9e-88b0-49c2-bf48-e6c00024feb7` — (sans titre) — flags: sensitive_admin
- `06be5180-3260-43bd-9b97-b908a11f6a68` — (sans titre) — flags: sensitive_admin
- `0715eab7-ba83-4f1e-b45c-740921a77064` — (sans titre) — flags: sensitive_admin
- `08dba933-a757-4a41-8832-68ad9ad93291` — (sans titre) — flags: sensitive_admin
- `0bb81227-d5d1-44d9-a3f4-ccdc01ca7f70` — (sans titre) — flags: sensitive_admin
- `0deb2039-d9fb-41f2-9206-44892352b926` — (sans titre) — flags: —
- `0eab511e-8524-4998-9bce-daf23aa5912d` — (sans titre) — flags: —
- `101d1444-f6f5-406d-9855-459f5e6f62b0` — (sans titre) — flags: sensitive_admin
- `12ede1af-823b-4284-a22b-777572c9e900` — (sans titre) — flags: sensitive_admin
- `16ea8cbd-36a7-4131-90d1-a07f131e8541` — (sans titre) — flags: sensitive_admin
- `1b4d279d-6552-4e01-8d9b-5c5d426ddc36` — (sans titre) — flags: sensitive_admin
- `1b700ea1-2877-4569-8b55-2566a2d32873` — (sans titre) — flags: sensitive_admin
- `1c66c72e-bbc0-4706-bcff-2f354059b2a3` — (sans titre) — flags: sensitive_admin
- `1e3ff1eb-0028-4284-97c8-357669d73a9c` — (sans titre) — flags: sensitive_admin
- `287669a3-cdd1-44ca-99b1-fbeef461a945` — (sans titre) — flags: sensitive_admin
- `294c2fc9-11f6-449a-b3ac-1dc65b491342` — (sans titre) — flags: —
- `3136af07-6d8a-41ea-8c34-7be16c843df8` — (sans titre) — flags: sensitive_admin
- `33382dd4-67d1-4435-8d69-890ac3e0ced8` — (sans titre) — flags: sensitive_admin
- `3ae5e71b-ccce-4af9-8d5b-ac16fd741b96` — (sans titre) — flags: sensitive_admin
- `3b6511c4-c322-4e7b-8483-214023fde39f` — (sans titre) — flags: sensitive_admin
- `3ea5f382-39ec-40eb-b2df-594f582e3eec` — (sans titre) — flags: sensitive_admin
- `3fc86172-1c36-4758-8389-aa915aa707a5` — (sans titre) — flags: sensitive_admin
- `45fa9050-1fd5-40e8-a1f8-ee36c9d89af1` — (sans titre) — flags: sensitive_admin
- `47428015-9cb3-441f-bcb6-83e53280fc83` — (sans titre) — flags: sensitive_admin
- `50c9d01d-3c79-4de0-bf58-b7fc1784b0fe` — (sans titre) — flags: —
- `51ca0951-1392-4399-b554-d94ad7f63fcb` — (sans titre) — flags: —
- `5448c46f-27cb-4add-8c67-9b3e4953d05c` — (sans titre) — flags: sensitive_admin
- `556cba0c-d037-4684-8ada-a5c2e97f6e52` — (sans titre) — flags: sensitive_admin
- `569692e7-5f18-4daf-b2d5-ae3c2deb7136` — (sans titre) — flags: sensitive_admin
- `5b456fc4-770a-42eb-9488-791d3b190301` — (sans titre) — flags: —
- `5c5cf93f-9e2f-4f5b-8f56-71ee1a100b73` — (sans titre) — flags: sensitive_admin
- `5e1834e3-b2d9-472e-977c-42774a8437d9` — (sans titre) — flags: sensitive_admin
- `5fbf1e86-0ac2-48d2-9872-654fbda528a9` — (sans titre) — flags: sensitive_admin
- `6044d100-9342-4c6e-a917-612563e4a186` — (sans titre) — flags: sensitive_admin
- `6086f4fe-efaa-474c-81e5-860b9d91f1af` — (sans titre) — flags: —
- `647fc278-effa-42c7-824e-ad72ad58cfb7` — (sans titre) — flags: sensitive_admin
- `66cdf013-b5b3-43eb-9d00-7286fab638de` — (sans titre) — flags: sensitive_admin
- `679a2446-7738-4839-ad55-8cbd847d3e25` — (sans titre) — flags: sensitive_admin
- `6c653288-b698-4ae3-b379-3d05b0095f52` — (sans titre) — flags: sensitive_admin
- `6ea666fe-708e-4535-ac03-11f4031b630d` — (sans titre) — flags: —
- `73fa072e-8136-4552-ab8e-9f38de873464` — (sans titre) — flags: sensitive_admin
- `75a37690-33fd-428c-90a7-8a00a304653f` — (sans titre) — flags: sensitive_admin
- `762d466c-0b38-4ca9-8d1a-baf1f9985258` — (sans titre) — flags: sensitive_admin
- `7c0b20c1-4f66-42da-9d9b-3ec3212601de` — (sans titre) — flags: sensitive_admin
- `7f6582eb-1415-4976-8a33-b4ed3d8ffae8` — (sans titre) — flags: sensitive_admin
- `82cc5547-bcae-422c-8fd3-87eecb0d1ad3` — (sans titre) — flags: sensitive_admin
- `8706c89a-6c4e-4cbf-afa1-4fa166549c72` — (sans titre) — flags: —
- `8c4a82ee-81c2-46db-af6f-415ed6d08d08` — (sans titre) — flags: sensitive_admin
- `8dc40198-db88-4da4-99df-993a5153754b` — (sans titre) — flags: —
- `8f75baab-153b-40ed-8bb6-a501c3894e55` — (sans titre) — flags: —
- `8f900054-b82a-4ab5-a4cc-fe900fd04536` — (sans titre) — flags: —
- `911ba239-e1a0-4280-bff5-7f37610fde92` — (sans titre) — flags: —
- `913a5b72-73ff-43f0-a7dd-a149d4e73050` — (sans titre) — flags: sensitive_admin
- `91cefa80-42ec-4166-a41e-df5915b1c451` — (sans titre) — flags: sensitive_admin
- `9445e75e-0b2d-4061-b2a6-dc5a22fe0703` — (sans titre) — flags: sensitive_admin
- `9469de1a-f470-4e11-9b46-d5102d302a73` — (sans titre) — flags: sensitive_admin
- `955f5e32-c42f-48b7-aa15-dc8bab29e67d` — (sans titre) — flags: sensitive_admin
- `9567217e-4ef3-45f6-895d-071ed663c7da` — (sans titre) — flags: sensitive_admin
- `99d30e6b-ecec-4b7d-ac1e-3c73f93ab9de` — (sans titre) — flags: sensitive_admin
- `8ae595e8-58f0-4a41-8fba-f45adcce08c7` — (sans titre) — flags: —
- `a064da4b-3e3f-4c87-b3f6-819315ad3750` — (sans titre) — flags: —
- `a2ca2b7e-2abb-49e8-8e56-2e6e73691057` — (sans titre) — flags: sensitive_admin
- `a2ccca6d-e787-4e0b-88cb-db71d8758b2b` — (sans titre) — flags: sensitive_admin
- `a51e30f5-35c0-479e-ba67-a19cc8126911` — (sans titre) — flags: —
- `a608e46a-b749-49a9-ab98-6caf44762074` — (sans titre) — flags: —
- `a723f47f-50c3-4ee5-9c85-517fecdd72ef` — (sans titre) — flags: sensitive_admin
- `a7907e6f-772c-4c9d-b4c3-4ac624294cb4` — (sans titre) — flags: —
- `ad0f1e82-f166-4322-a237-ec4921f1fd6a` — (sans titre) — flags: sensitive_admin
- `b16bea72-4bdf-4e8a-bb79-1d164e537a13` — (sans titre) — flags: —
- `b314e99b-86bf-4c89-b3e5-d6f9947954e9` — (sans titre) — flags: sensitive_admin
- `b6f344b4-4f6b-42cc-b2a2-b0923c7f0e04` — (sans titre) — flags: sensitive_admin
- `b7ae4a07-26bd-4cc3-88a8-67d878148b00` — (sans titre) — flags: sensitive_admin
- `bfff2dfd-d573-4f9c-a083-40471a39fc76` — (sans titre) — flags: sensitive_admin
- `c091303b-b833-402f-b4d4-dedb487807d2` — (sans titre) — flags: —
- `c17b0261-3550-42a8-ae3b-5a87bf2cc136` — (sans titre) — flags: sensitive_admin
- `c255174e-a56e-4f52-99d2-b652a5a84e50` — (sans titre) — flags: sensitive_admin
- `c27c0b88-fd75-4b0e-bced-057a7055a480` — (sans titre) — flags: sensitive_admin
- `c5e62f1c-c187-4d90-bcfd-4ac281a7d730` — (sans titre) — flags: sensitive_admin
- `cea58e38-ab3d-4e9b-9d9d-afed38421f1a` — (sans titre) — flags: —
- `cf6f5de6-0338-40a4-9d23-56b6394200c9` — (sans titre) — flags: —
- `d1b54299-e862-4d2b-8909-72af93be8bc6` — (sans titre) — flags: —
- `d41f46b7-dbe3-4dce-b717-076debcfb022` — (sans titre) — flags: sensitive_admin
- `d501e653-0013-40a3-a19e-ef9d8db3278a` — (sans titre) — flags: sensitive_admin
- `d8591d0b-27e5-42ba-8447-1be67da534f0` — (sans titre) — flags: —

_… et 98 autres._

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