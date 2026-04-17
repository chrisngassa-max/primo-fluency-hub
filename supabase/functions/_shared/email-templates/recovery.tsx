/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  token: string
}

export const RecoveryEmail = ({ token }: RecoveryEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Ton code de connexion CAP TCF</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Ton code de connexion</Heading>
        <Text style={text}>
          Saisis le code ci-dessous dans l'application pour te connecter.
          Ce code expire dans quelques minutes.
        </Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          Si tu n'as pas demandé ce code, tu peux ignorer cet email.
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
const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '32px',
  fontWeight: 'bold' as const,
  color: '#225FA6',
  letterSpacing: '4px',
  textAlign: 'center' as const,
  margin: '0 0 30px',
  padding: '16px',
  backgroundColor: '#F5F7FA',
  borderRadius: '10px',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
