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

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Tu es invité(e) à rejoindre CAP TCF</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Tu es invité(e) !</Heading>
        <Text style={text}>
          Tu as été invité(e) à rejoindre{' '}
          <Link href={siteUrl} style={link}>
            <strong>CAP TCF</strong>
          </Link>
          . Clique sur le bouton ci-dessous pour accepter l'invitation et
          créer ton compte.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Accepter l'invitation
        </Button>
        <Text style={footer}>
          Si tu n'attendais pas cette invitation, tu peux ignorer cet email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

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
