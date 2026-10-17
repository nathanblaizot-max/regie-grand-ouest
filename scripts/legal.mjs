// Pages légales (mentions, conditions générales, confidentialité) générées à partir de scripts/legal-config.json.
// Un champ vide du fichier de configuration s'affiche « [à compléter] » sur la page.
import fs from 'node:fs';

const MAJ = '17 octobre 2026';
const cfg = JSON.parse(fs.readFileSync(process.env.LEGAL_CONFIG || new URL('./legal-config.json', import.meta.url), 'utf8'));
const OUT = process.env.LEGAL_OUT || new URL('../public/', import.meta.url).pathname;
const TBD = '<span class="tbd">[à compléter]</span>';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const val = (k) => (String(cfg[k] || '').trim() ? esc(String(cfg[k]).trim()) : TBD);
export const missing = ['nom', 'forme', 'capital', 'adresse', 'rcsVille', 'siren', 'siret', 'tva', 'naf', 'email', 'tel', 'directeur'].filter((k) => !String(cfg[k] || '').trim());
const e = { nom: val('nom'), forme: val('forme'), cap: val('capital'), adr: val('adresse'), rcs: val('rcsVille'), siren: val('siren'), siret: val('siret'), tva: val('tva'), naf: val('naf'), dir: val('directeur') };
const m = String(cfg.email || '').trim(), t = String(cfg.tel || '').trim();
const mail = m ? `<a href="mailto:${esc(m)}">${esc(m)}</a>` : TBD;
const tel = t ? `<a href="tel:${esc(t.replace(/[^\d+]/g, ''))}">${esc(t)}</a>` : TBD;

const CSS = `<style>
:root{--bg:#F6F8FA;--card:#fff;--fg:#0B2A3A;--mut:#4F6676;--line:#DDE6EC;--pri:#023047;--gold:#D0BB63;--link:#0A4560;padding-block:env(safe-area-inset-top,0px) env(safe-area-inset-bottom,0px)}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#07161E;--card:#0E2530;--fg:#EAF1F5;--mut:#9DB3C0;--line:#1B3948;--pri:#D0BB63;--link:#D8C56F;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.65 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-text-size-adjust:100%}
.wrap{width:100%;max-width:780px;margin:0 auto;padding:20px 16px 56px}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding-block:6px 18px}.top a{color:var(--link);font-weight:600;text-decoration:none}
.top .brand{font:700 20px Georgia,"Times New Roman",serif;color:var(--fg)}
article{background:var(--card);border:1px solid var(--line);border-radius:18px 4px 18px 4px;padding:clamp(18px,4vw,34px)}
h1{font:700 clamp(26px,5vw,34px)/1.15 Georgia,"Times New Roman",serif;margin:0 0 6px;text-wrap:balance}
h2{font:700 19px/1.3 Georgia,"Times New Roman",serif;margin:30px 0 8px;color:var(--fg)}
p,li{color:var(--fg)}p{margin:0 0 12px}ul{margin:0 0 12px;padding-left:22px}li{margin-bottom:5px}
.maj{color:var(--mut);font-size:14px;margin-bottom:18px}
dl{display:grid;grid-template-columns:minmax(120px,200px) 1fr;gap:8px 16px;margin:0 0 12px}dt{font-weight:600;color:var(--mut)}dd{margin:0;min-width:0;overflow-wrap:anywhere}
a{color:var(--link)}.foot{margin-top:22px;display:flex;flex-wrap:wrap;gap:6px 18px;font-size:14px;color:var(--mut);justify-content:center}
.note{background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:12px 14px;font-size:14.5px;color:var(--mut)}
@media (max-width:560px){dl{grid-template-columns:1fr;gap:2px}dt{margin-top:8px}}
</style>`;
function page(slug, title, desc, body) {
  const nav = '<a href="/mentions-legales">Mentions légales</a><a href="/conditions">Conditions générales</a><a href="/confidentialite">Confidentialité</a>';
  const h = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#023047">
<meta name="description" content="${esc(desc)}">
<title>${esc(title)} · Loc en poche</title>
<link rel="icon" href="/icon-192.png">
${CSS}
</head>
<body>
<div class="wrap">
<div class="top"><span class="brand">Loc en poche</span><a href="/">← Retour à l’accueil</a></div>
<article>
<h1>${esc(title)}</h1>
<p class="maj">Dernière mise à jour : ${MAJ}</p>
${body}
</article>
<nav class="foot" aria-label="Pages légales">${nav}</nav>
</div>
</body>
</html>
`;
  fs.writeFileSync(OUT + '/' + slug + '.html', h);
}

const editeur = `<dl>
<dt>Éditeur</dt><dd><b>${e.nom}</b>, ${e.forme} au capital de ${e.cap}</dd>
<dt>Siège social</dt><dd>${e.adr}</dd>
<dt>Immatriculation</dt><dd>RCS ${e.rcs} · SIREN ${e.siren} · SIRET ${e.siret}</dd>
<dt>TVA intracommunautaire</dt><dd>${e.tva}</dd>
<dt>Code NAF</dt><dd>${e.naf}</dd>
<dt>Contact</dt><dd>${mail} · ${tel}</dd>
<dt>Directeur de la publication</dt><dd>${e.dir}</dd>
</dl>`;
const mentions = `
<h2>Éditeur du site et du service</h2>
<p>Le site « Loc en poche » et l’application de gestion de location de matériel qu’il propose sont édités par :</p>
${editeur}
<h2>Hébergement</h2>
<dl>
<dt>Hébergeur</dt><dd>Netlify, Inc.</dd>
<dt>Adresse</dt><dd>512 2nd Street, Suite 200, San Francisco, CA 94107, États-Unis</dd>
<dt>Site</dt><dd><a href="https://www.netlify.com" rel="noopener">www.netlify.com</a></dd>
</dl>
<p>Les données du service sont hébergées sur l’infrastructure de Netlify, dont les serveurs peuvent être situés hors de l’Union européenne, notamment aux États-Unis. Voir la <a href="/confidentialite">politique de confidentialité</a>.</p>
<h2>Nature du service</h2>
<p>Loc en poche est un service en ligne d’aide à la gestion destiné aux professionnels de la location de matériel (devis, factures, stock, clients, planning, caisse d’évènement). Il est proposé par abonnement dans les conditions décrites dans les <a href="/conditions">conditions générales d’abonnement et d’utilisation</a>.</p>
<h2>Propriété intellectuelle</h2>
<p>L’application, son code, ses textes, son design, ses logos et son nom sont la propriété de l’éditeur ou utilisés avec l’accord de leurs titulaires, et sont protégés par le droit de la propriété intellectuelle. Toute reproduction, représentation ou réutilisation, totale ou partielle, sans autorisation écrite préalable est interdite. Les données saisies par les clients dans leur espace restent leur propriété.</p>
<h2>Responsabilité</h2>
<p>L’éditeur s’efforce de fournir des informations et un service fiables et à jour, mais ne garantit ni l’absence totale d’erreur ni une disponibilité ininterrompue. Les documents produits avec l’application (devis, factures, récapitulatifs) restent sous la responsabilité de leur émetteur, qui doit vérifier qu’ils respectent ses obligations légales, comptables et fiscales. Le site peut contenir des liens vers des sites tiers dont l’éditeur n’est pas responsable.</p>
<h2>Données personnelles et cookies</h2>
<p>Le traitement des données personnelles est détaillé dans la <a href="/confidentialite">politique de confidentialité</a>. Le site n’utilise pas de cookie publicitaire ni de traceur de mesure d’audience.</p>
<h2>Droit applicable</h2>
<p>Le site est soumis au droit français. Pour toute question ou réclamation, vous pouvez écrire à ${mail}.</p>
`;
const cgv = `
<p class="note">Les présentes conditions s’appliquent à tout abonnement au service Loc en poche. Le service est réservé aux professionnels, qui agissent pour les besoins de leur activité.</p>
<h2>1. Objet et éditeur</h2>
<p>Les présentes conditions générales (« CGV ») régissent l’accès et l’utilisation du service en ligne Loc en poche (le « Service »), édité par ${e.nom}, ${e.forme} au capital de ${e.cap}, dont le siège est situé ${e.adr}, immatriculée au RCS de ${e.rcs} sous le numéro ${e.siren} (l’« Éditeur »). Les coordonnées de l’Éditeur figurent dans les <a href="/mentions-legales">mentions légales</a>. Le client (le « Client ») est le professionnel qui crée un compte et souscrit au Service.</p>
<h2>2. Description du Service</h2>
<p>Le Service est une application web de gestion de location de matériel : devis, factures, catalogue et stock, clients, planning, tournées, caisse d’évènement, états des lieux et documents associés. L’abonnement donne accès à la totalité des fonctionnalités du Service et au système de paiement proposé avec celui-ci, au fur et à mesure de leur mise à disposition. Le Service est accessible depuis un navigateur sur ordinateur et téléphone ; il nécessite une connexion internet.</p>
<h2>3. Compte et accès</h2>
<p>L’accès au Service se fait par un compte créé par l’Éditeur à la suite d’une demande du Client. Le Client choisit des identifiants personnels, les garde confidentiels et répond de l’usage qui en est fait. Il peut créer des accès pour les personnes de son équipe, dont il reste responsable. Il informe l’Éditeur sans délai de toute utilisation non autorisée de son compte.</p>
<h2>4. Essai gratuit de 7 jours</h2>
<p>Le Client bénéficie d’un essai gratuit de 7 jours à compter de l’ouverture de son compte, avec accès à la totalité du Service. Il peut mettre fin à l’essai à tout moment avant son terme, sans frais. À l’issue de l’essai, l’accès au Service se poursuit sous forme d’abonnement payant aux conditions de l’article 5, sauf si le Client y a mis fin avant. Un seul essai gratuit est accordé par Client.</p>
<h2>5. Prix et paiement</h2>
<p>L’abonnement est de <b>39,99 € HT par mois</b>. La TVA applicable s’ajoute au prix (soit 47,99 € TTC par mois au taux actuel de 20 %). Il est facturé mensuellement, d’avance, et réglé selon les moyens de paiement proposés lors de la souscription. Une facture est mise à disposition du Client pour chaque période. En cas de retard de paiement, l’Éditeur peut suspendre l’accès au Service après mise en demeure restée sans effet ; des pénalités de retard au taux de trois fois le taux d’intérêt légal et une indemnité forfaitaire de recouvrement de 40 € sont alors exigibles.</p>
<p>L’Éditeur peut modifier le prix de l’abonnement. Le Client en est informé par écrit au moins 30 jours avant l’entrée en vigueur du nouveau prix et peut résilier avant cette date.</p>
<h2>6. Durée et résiliation</h2>
<p>L’abonnement est conclu pour une durée d’un mois et se renouvelle tacitement de mois en mois. Il est <b>résiliable à tout moment</b>, sans motif ni pénalité, par le Client, depuis son compte lorsque cette option est disponible ou par message à ${mail}. La résiliation prend effet à la fin de la période mensuelle en cours, déjà payée, que le Client peut utiliser jusqu’à son terme ; aucun remboursement au prorata n’est dû. L’Éditeur peut résilier l’abonnement, avec un préavis raisonnable, en cas de manquement grave du Client à ses obligations, notamment d’impayé ou d’usage contraire aux CGV.</p>
<h2>7. Données du Client</h2>
<p>Le Client reste propriétaire de toutes les données qu’il saisit dans le Service (catalogue, clients, documents, photos, etc.). Il peut à tout moment les exporter depuis les réglages (sauvegarde complète). Après la fin de l’abonnement, les données sont conservées 30 jours pour permettre au Client de les récupérer, puis supprimées. Le Client est responsable du caractère licite des données qu’il enregistre, notamment à l’égard de ses propres clients (voir article 11).</p>
<h2>8. Obligations du Client</h2>
<p>Le Client utilise le Service conformément à la loi et aux présentes CGV. Il s’interdit notamment de tenter d’accéder aux données d’autres clients, de perturber le fonctionnement du Service, de copier ou revendre le Service, ou d’y enregistrer des contenus illicites. Les devis, factures, contrats et calculs produits avec le Service sont établis sous la responsabilité du Client, qui vérifie leur exactitude et leur conformité à ses obligations légales, comptables et fiscales.</p>
<h2>9. Disponibilité et support</h2>
<p>L’Éditeur met en œuvre les moyens raisonnables pour que le Service soit accessible en continu, mais n’est tenu qu’à une obligation de moyens. Des interruptions peuvent survenir pour maintenance, mise à jour ou raison indépendante de sa volonté (panne de l’hébergeur, du réseau, etc.). Le Service évolue : l’Éditeur peut ajouter, modifier ou retirer des fonctionnalités, sans remettre en cause l’essentiel du Service. Le support est assuré par e-mail à ${mail}.</p>
<h2>10. Responsabilité</h2>
<p>La responsabilité de l’Éditeur ne peut être engagée qu’en cas de faute prouvée et pour les seuls dommages directs. Elle est limitée, tous préjudices confondus, au montant payé par le Client au cours des 12 mois précédant le fait générateur. L’Éditeur n’est pas responsable des dommages indirects (perte de chiffre d’affaires, de clientèle, de données non sauvegardées par le Client, etc.), ni des conséquences d’une mauvaise utilisation du Service, d’une saisie erronée ou d’une indisponibilité de l’hébergeur. Ces limites ne s’appliquent pas en cas de faute lourde ou dolosive, ni lorsque la loi l’interdit.</p>
<h2>11. Données personnelles</h2>
<p>L’Éditeur traite les données personnelles dans le respect du règlement général sur la protection des données (RGPD). Pour les données de son compte et de sa demande d’inscription, l’Éditeur est responsable de traitement. Pour les données de ses propres clients que le Client enregistre dans le Service, le Client est responsable de traitement et l’Éditeur agit comme son sous-traitant : il ne les traite que sur instruction du Client, pour fournir le Service, avec des mesures de sécurité adaptées, et les supprime ou les restitue à la fin du contrat. Les détails figurent dans la <a href="/confidentialite">politique de confidentialité</a>.</p>
<h2>12. Propriété intellectuelle</h2>
<p>Le Service, son code, ses contenus et sa marque restent la propriété de l’Éditeur. Le Client bénéficie, pendant la durée de l’abonnement, d’un droit d’utilisation personnel, non exclusif et non transférable, pour ses besoins professionnels.</p>
<h2>13. Modification des CGV</h2>
<p>L’Éditeur peut modifier les présentes CGV. Les nouvelles conditions sont communiquées au Client au moins 30 jours avant leur entrée en vigueur ; en cas de désaccord, le Client peut résilier avant cette date. La poursuite de l’utilisation du Service après cette date vaut acceptation.</p>
<h2>14. Droit applicable et litiges</h2>
<p>Les présentes CGV sont soumises au droit français. En cas de difficulté, les parties cherchent d’abord une solution amiable. À défaut, les tribunaux compétents sont ceux du ressort du siège de l’Éditeur (tribunal de commerce de ${e.rcs}), sauf règle de compétence impérative contraire.</p>
`;
const conf = `
<h2>Qui est responsable de vos données ?</h2>
<p>${e.nom}, ${e.adr} (voir les <a href="/mentions-legales">mentions légales</a>). Contact pour toute question sur vos données : ${mail}.</p>
<h2>Quelles données, pourquoi et pendant combien de temps ?</h2>
<ul>
<li><b>Demande d’inscription ou de démonstration</b> (formulaire de la page d’accueil) : nom, société, secteur d’activité, taille du parc, e-mail, téléphone, message. Finalité : répondre à votre demande, ouvrir votre essai gratuit et vous recontacter. Base légale : votre consentement et les mesures précontractuelles prises à votre demande. Durée : conservées au plus 3 ans après notre dernier échange, ou supprimées plus tôt sur votre demande.</li>
<li><b>Compte et utilisation du Service</b> : identité, e-mail, identifiants (mot de passe conservé sous forme chiffrée), rôle, journaux techniques nécessaires à la sécurité. Finalité : fournir le Service et assurer sa sécurité. Base légale : exécution du contrat. Durée : la durée de l’abonnement, puis 30 jours avant suppression, hors obligations légales de conservation (facturation notamment).</li>
<li><b>Données que vous enregistrez dans le Service</b> (clients, devis, factures, photos, etc.) : elles vous appartiennent. Pour les données personnelles de vos propres clients, vous êtes responsable de traitement et nous agissons comme votre sous-traitant (article 28 du RGPD) : nous ne les utilisons que pour faire fonctionner le Service, jamais pour nos propres besoins ni à des fins commerciales.</li>
<li><b>Facturation</b> : données nécessaires à la facturation de l’abonnement, conservées selon les durées légales. Quand le paiement en ligne sera activé, les données de carte bancaire seront traitées par un prestataire de paiement agréé et ne seront pas stockées par l’Éditeur.</li>
</ul>
<h2>Qui reçoit vos données ?</h2>
<p>Elles ne sont ni vendues ni cédées. Elles sont traitées par l’Éditeur et par ses prestataires techniques, uniquement pour les finalités ci-dessus :</p>
<ul>
<li><b>Netlify, Inc.</b> (États-Unis) : hébergement du site, de l’application, de la base de données et des fichiers (photos, PDF), et réception des formulaires ;</li>
<li><b>Google (Gmail)</b> : messagerie dans laquelle sont reçues les demandes d’inscription et par laquelle nous vous répondons ;</li>
<li>un prestataire de paiement agréé, lorsque le paiement en ligne sera mis en service.</li>
</ul>
<p>Certains de ces prestataires sont établis ou stockent des données hors de l’Union européenne, notamment aux États-Unis. Ces transferts sont encadrés par les garanties prévues par le RGPD (décision d’adéquation ou clauses contractuelles types).</p>
<h2>Cookies et traceurs</h2>
<p>Le site n’utilise ni cookie publicitaire ni outil de mesure d’audience. Il utilise uniquement un cookie de session strictement nécessaire à la connexion à votre compte, ainsi que le stockage local de votre navigateur pour retenir vos préférences d’affichage : ces éléments ne requièrent pas de consentement.</p>
<p>Pour s’afficher, la page d’accueil charge des polices de caractères depuis le service Google Fonts : votre adresse IP est alors transmise à Google. Vous pouvez vous y opposer en bloquant ces requêtes dans votre navigateur ; la page reste utilisable avec des polices de remplacement.</p>
<h2>Sécurité</h2>
<p>Les échanges sont chiffrés (HTTPS), les mots de passe sont stockés sous forme chiffrée, chaque client n’accède qu’à ses propres données et les accès sont limités au strict nécessaire. Aucun système n’étant infaillible, nous vous informerons, ainsi que l’autorité compétente lorsque la loi l’exige, en cas de violation de données vous concernant.</p>
<h2>Vos droits</h2>
<p>Vous disposez d’un droit d’accès, de rectification, d’effacement, de limitation, d’opposition et de portabilité de vos données, ainsi que du droit de retirer votre consentement à tout moment et de définir des directives sur le sort de vos données après votre décès. Pour les exercer, écrivez à ${mail} ; nous répondons dans un délai d’un mois. Si vous estimez que vos droits ne sont pas respectés, vous pouvez introduire une réclamation auprès de la CNIL (<a href="https://www.cnil.fr" rel="noopener">www.cnil.fr</a>).</p>
<p>Si vous êtes le client final d’un loueur qui utilise Loc en poche, adressez-vous d’abord à ce loueur, responsable du traitement de vos données.</p>
<h2>Modifications</h2>
<p>Cette politique peut évoluer ; la date de dernière mise à jour figure en haut de la page.</p>
`;

page('mentions-legales', 'Mentions légales', 'Mentions légales de Loc en poche.', mentions);
page('conditions', 'Conditions générales d’abonnement et d’utilisation', 'Conditions générales d’abonnement et d’utilisation de Loc en poche : 39,99 € HT par mois, 7 jours d’essai gratuit, résiliable à tout moment.', cgv);
page('confidentialite', 'Politique de confidentialité', 'Politique de confidentialité et protection des données personnelles de Loc en poche.', conf);
if (missing.length) console.log('Pages légales : champs à compléter dans scripts/legal-config.json → ' + missing.join(', '));
