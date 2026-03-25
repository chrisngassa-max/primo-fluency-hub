/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "CAP TCF"

interface NewStudentNotificationProps {
  studentName?: string
  studentEmail?: string
}

const NewStudentNotificationEmail = ({ studentName, studentEmail }: NewStudentNotificationProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Nouvel élève en attente de validation sur {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Nouvel élève inscrit</Heading>
        <Text style={text}>
          {studentName
            ? `L'élève ${studentName} (${studentEmail || 'email non renseigné'}) vient de s'inscrire sur ${SITE_NAME} et attend ta validation.`
            : `Un nouvel élève vient de s'inscrire sur ${SITE_NAME} et attend ta validation.`}
        </Text>
        <Text style={text}>
          Connecte-toi à ton espace formateur pour approuver ou refuser cette demande d'accès.
        </Text>
        <Text style={footerStyle}>
          — L'équipe {SITE_NAME}
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: NewStudentNotificationEmail,
  subject: (data: Record<string, any>) =>
    data.studentName
      ? `[CAP TCF] Nouvel élève inscrit : ${data.studentName}`
      : '[CAP TCF] Nouvel élève en attente de validation',
  displayName: 'Notification nouvel élève',
  previewData: { studentName: 'Jean Dupont', studentEmail: 'jean.dupont@example.com' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#171D27',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#6B7082',
  lineHeight: '1.5',
  margin: '0 0 25px',
}
const footerStyle = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
