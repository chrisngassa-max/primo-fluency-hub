/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Confirme ton adresse email pour CAP TCF</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Confirme ton adresse email</Heading>
        <Text style={text}>
          Merci de t'être inscrit(e) sur{' '}
          <Link href={siteUrl} style={link}>
            <strong>CAP TCF</strong>
          </Link>{' '}
          !
        </Text>
        <Text style={text}>
          Confirme ton adresse (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ) en cliquant sur le bouton ci-dessous :
        </Text>
        <Button style={button} href={confirmationUrl}>
          Vérifier mon email
        </Button>
        <Text style={footer}>
          Si tu n'as pas créé de compte, tu peux ignorer cet email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

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
const link = { color: 'inherit', textDecoration: 'underline' }
const button = {
  backgroundColor: '#225FA6',
  color: '#ffffff',
  fontSize: '14px',
  borderRadius: '10px',
  padding: '12px 20px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
