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

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Réinitialise ton mot de passe CAP TCF</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Réinitialise ton mot de passe</Heading>
        <Text style={text}>
          Tu as demandé à réinitialiser ton mot de passe pour CAP TCF.
          Clique sur le bouton ci-dessous pour choisir un nouveau mot de passe.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Réinitialiser mon mot de passe
        </Button>
        <Text style={footer}>
          Si tu n'as pas fait cette demande, ignore simplement cet email.
          Ton mot de passe ne sera pas modifié.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

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
const button = {
  backgroundColor: '#225FA6',
  color: '#ffffff',
  fontSize: '14px',
  borderRadius: '10px',
  padding: '12px 20px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
