import { Link } from "react-router-dom";
import logo from "../assets/logo.png";
import "./PrivacyPolicyView.css";

function PrivacyPolicyView() {
  return (
    <div className="privacy-page">
      <div className="privacy-page__bar">
        <Link to="/" className="privacy-page__bar-link">
          <img src={logo} alt="Wishlist" className="privacy-page__bar-logo" />
        </Link>
      </div>

      <div className="privacy-page__content">
        <p className="privacy-page__eyebrow">Wishlist</p>
        <h1 className="privacy-page__title">Privacy Policy</h1>
        <p className="privacy-page__updated">Last Updated: September 11, 2026</p>

        <p className="privacy-page__disclaimer">
          Wishlist is an experimental personal portfolio project and is provided primarily for
          demonstration and evaluation purposes. Users should not submit sensitive, confidential,
          or otherwise highly private information.
        </p>

        <section className="privacy-section">
          <h2>1. Introduction</h2>
          <p>
            This Privacy Policy describes how Wishlist collects, uses, stores, processes, and
            discloses information when someone uses the Wishlist web application, the Wishlist
            browser extension, and related Wishlist features and services (together,
            &ldquo;Wishlist&rdquo;).
          </p>
          <p>
            Wishlist is a personal portfolio and experimental software project. It is not currently
            operated as a commercial business or paid service.
          </p>
          <p>
            By using Wishlist, you acknowledge the practices described in this Privacy Policy.
          </p>
        </section>

        <section className="privacy-section">
          <h2>2. Information We Collect</h2>

          <h3>Account Information</h3>
          <p>
            Creating an account requires a display name, an email address, and a password.
            Authentication is handled by Supabase Auth, a third-party authentication service.
            Wishlist does not store your password in plaintext; password handling and storage are
            managed by Supabase Auth. Supabase Auth also manages sign-in sessions and processes the
            information necessary to issue and refresh those sessions.
          </p>
          <p>
            Your display name is also stored in Wishlist&rsquo;s own database so it can be shown
            back to you in the application. You may optionally add a profile photo, which is stored
            as described under &ldquo;Images and Uploaded Content&rdquo; below.
          </p>

          <h3>Wishlist and Product Information</h3>
          <p>
            When you save a product &mdash; whether through the browser extension or by adding an
            item manually &mdash; Wishlist stores the product information you saved or entered.
            Depending on how the item was added, this may include: the product name, price,
            currency, a link to the retailer&rsquo;s product image, color, size, the retailer or
            store name, the product&rsquo;s web address, the date it was saved, and whether the
            item is marked as something you already own versus something you are considering.
          </p>

          <h3>User-Created Content</h3>
          <p>
            Wishlist stores the Collections and Outfits (referred to in the application as
            &ldquo;Looks&rdquo;) that you create, including which saved items belong to each one
            and how pieces are arranged within an outfit in Look Studio.
          </p>

          <h3>Images and Uploaded Content</h3>
          <p>You may provide or generate the following images within Wishlist:</p>
          <ul>
            <li>An account profile photo.</li>
            <li>A photo of an item you add manually (for example, something you already own).</li>
            <li>
              An optional model or reference photo used in Look Studio and, if you use the
              Visualize feature, as the reference image for your generated illustration.
            </li>
            <li>
              A background-removed (&ldquo;cutout&rdquo;) version of a product image that you
              create using the cutout tool.
            </li>
            <li>
              An AI-generated outfit illustration, if you choose to save one produced by the
              Visualize feature.
            </li>
          </ul>
          <p>
            Uploaded and generated images are stored using Supabase Storage. Profile photos, manual
            item photos, and Look Studio reference photos are stored in access-restricted storage
            and are retrievable only through your own authenticated session. Product cutouts and
            saved Visualize illustrations are stored at a distinct, non-public file address that is
            not published or linked publicly within the application, but that storage location does
            not require authentication to retrieve if the exact address were somehow known.
          </p>
          <p>
            Note that when you save a product from a retailer&rsquo;s website, Wishlist typically
            stores only a link to the retailer&rsquo;s own hosted product image, not a separate copy
            of that image, unless you use the cutout tool or Visualize to create a new derived
            image as described above.
          </p>

          <h3>Browser Extension Information</h3>
          <p>
            The Wishlist browser extension can read product information from the page you are
            currently viewing &mdash; such as the product name, price, currency, image, color, and
            web address &mdash; so that it can offer to save that product to your Wishlist. This
            information is extracted only when you open the extension&rsquo;s popup on a product
            page, and it is only sent to Wishlist&rsquo;s backend when you explicitly choose to save
            the item. Wishlist does not use the extension to create or maintain a history of the
            websites you browse.
          </p>
          <p>
            The extension requests the following browser permissions:{" "}
            <code>activeTab</code>, <code>storage</code>, and <code>scripting</code>. Its ability to
            make network requests is restricted to Wishlist&rsquo;s own backend address; it is not
            permitted to send data to arbitrary third-party servers.
          </p>
        </section>

        <section className="privacy-section">
          <h2>3. How We Use Information</h2>
          <p>Information collected through Wishlist may be used to:</p>
          <ul>
            <li>Authenticate you and maintain your account and sign-in session.</li>
            <li>Provide Wishlist&rsquo;s core functionality, including saving and organizing products.</li>
            <li>Create and manage Collections.</li>
            <li>Create and persist Outfits in Look Studio.</li>
            <li>Process product images you choose to cut out or use with Visualize.</li>
            <li>Generate AI-assisted outfit visualizations that you request.</li>
            <li>Maintain the security and integrity of the application.</li>
            <li>Troubleshoot issues and improve the application.</li>
          </ul>
          <p>Wishlist does not sell personal information.</p>
        </section>

        <section className="privacy-section">
          <h2>4. Product Image Processing</h2>
          <p>
            Wishlist&rsquo;s cutout (background-removal) tool uses a client-side image segmentation
            model called SlimSAM, run in your browser using ONNX Runtime Web and WebAssembly. When
            you use this tool, the segmentation process itself &mdash; identifying which pixels
            belong to the product versus the background &mdash; runs locally in your browser rather
            than being sent to a remote segmentation service. The photo you are cutting out is not
            uploaded to a dedicated third-party segmentation provider for this purpose.
          </p>
          <p>
            The segmentation model&rsquo;s own files are downloaded from Hugging Face&rsquo;s
            servers the first time you use the tool, so that the model can subsequently run
            locally; this download does not include your photo. Separately, if a retailer&rsquo;s
            image cannot be loaded directly in your browser due to cross-origin restrictions,
            Wishlist may retrieve that image through its own server-side proxy solely to make the
            image readable in your browser &mdash; this proxy does not perform AI processing and
            does not retain a copy of the image.
          </p>
          <p>
            This local-processing description applies specifically to the cutout/segmentation tool.
            It does not describe how other Wishlist features, such as Visualize, process images.
          </p>
        </section>

        <section className="privacy-section">
          <h2>5. AI-Generated Outfit Visualizations</h2>
          <p className="privacy-page__callout">
            Using the Visualize feature involves third-party AI processing.
          </p>
          <p>
            Wishlist uses Google Gemini to generate an illustrated visualization of an outfit you
            have composed in Look Studio. When you use Visualize, the following information is sent
            to Gemini in order to generate the requested image: the images of the pieces in the
            outfit (a background-removed cutout, if one exists, or the item&rsquo;s product image
            otherwise), descriptive information about those pieces, your selected visualization
            style, and a reference photo &mdash; either a model/reference photo you have uploaded,
            or the application&rsquo;s default reference image if you have not uploaded one.
          </p>
          <p>
            This request is routed through a server-side Supabase Edge Function rather than being
            sent to Gemini directly from your browser. Wishlist&rsquo;s Gemini API credentials are
            kept on the server and are not exposed to the client.
          </p>
          <p>
            Google may process the information necessary to generate the requested output in
            accordance with Google&rsquo;s applicable privacy terms and policies, which you can
            review at{" "}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
              policies.google.com/privacy
            </a>{" "}
            and{" "}
            <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer">
              ai.google.dev/gemini-api/terms
            </a>
            .
          </p>
          <p>
            Users should not submit images or other content that they do not have the right or
            permission to use.
          </p>
          <p>
            You are not required to use Visualize in order to use the rest of Wishlist. Saving
            products, creating Collections, and building Outfits in Look Studio do not require you
            to generate or submit any visualization.
          </p>
        </section>

        <section className="privacy-section">
          <h2>6. Third-Party Service Providers</h2>
          <p>Wishlist relies on the following third-party services to operate:</p>
          <div className="privacy-table-wrap">
            <table className="privacy-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Purpose</th>
                  <th>Information Involved</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">
                      Supabase
                    </a>
                  </td>
                  <td>Authentication, PostgreSQL database, file storage, and server-side functions</td>
                  <td>Account credentials and session data, Wishlist/Collection/Outfit data, uploaded and generated images</td>
                </tr>
                <tr>
                  <td>
                    <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer">
                      Google Gemini
                    </a>
                  </td>
                  <td>AI-generated outfit visualizations (Visualize feature)</td>
                  <td>Outfit/product imagery, a reference photo, and a style selection, as described in Section 5</td>
                </tr>
                <tr>
                  <td>
                    <a href="https://developers.google.com/fonts/faq/privacy" target="_blank" rel="noopener noreferrer">
                      Google Fonts
                    </a>
                  </td>
                  <td>Loading the typefaces used in the interface</td>
                  <td>Standard browser request information (e.g., IP address), as with loading any web font</td>
                </tr>
                <tr>
                  <td>
                    <a href="https://huggingface.co/privacy" target="_blank" rel="noopener noreferrer">
                      Hugging Face
                    </a>
                  </td>
                  <td>Delivery of the SlimSAM model files used for in-browser image segmentation</td>
                  <td>Standard browser request information when the model is first downloaded; your product photo is not sent to Hugging Face</td>
                </tr>
                <tr>
                  <td>
                    <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
                      Vercel
                    </a>
                  </td>
                  <td>Hosting and serving the Wishlist web application</td>
                  <td>Standard web request information inherent to serving any website (e.g., IP address, request metadata)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="privacy-section">
          <h2>7. Cookies and Similar Technologies</h2>
          <p>
            Wishlist does not implement its own analytics, advertising, or tracking cookies. Your
            sign-in session is maintained using your browser&rsquo;s local storage (or, within the
            browser extension, <code>chrome.storage</code>) rather than a tracking cookie set by
            Wishlist. Supabase, Google Fonts, and other service providers described in Section 6 may
            use their own browser storage or session-related technologies as part of delivering
            their service; Wishlist does not control those mechanisms directly.
          </p>
        </section>

        <section className="privacy-section">
          <h2>8. Data Storage and Security</h2>
          <p>
            Application data is stored using Supabase, backed by a PostgreSQL database. Uploaded and
            generated images are stored using Supabase Storage, as described in Section 2. Supabase
            Auth manages authentication. PostgreSQL Row Level Security (RLS) policies are used to
            restrict access to database records and storage files so that they are associated with,
            and generally only retrievable by, the authenticated user who owns them. Gemini API
            credentials are kept in server-side Edge Function secrets and are not exposed to the
            client.
          </p>
          <p>
            Wishlist uses reasonable technical measures intended to protect application data.
            However, no method of transmission or electronic storage can be guaranteed to be
            completely secure.
          </p>
        </section>

        <section className="privacy-section">
          <h2>9. Data Retention</h2>
          <p>
            Wishlist does not currently apply a fixed, automatic retention period to most account or
            product data. Information may be retained for as long as necessary to operate the
            project, maintain your account, provide requested functionality, comply with applicable
            obligations, or resolve security and technical issues. Because Wishlist is an
            experimental project, its data practices may evolve as the application changes.
          </p>
        </section>

        <section className="privacy-section">
          <h2>10. Data Sharing and Disclosure</h2>
          <p>
            Wishlist may disclose or process information with the service providers described in
            Section 6 to the extent necessary to operate the application. Wishlist does not sell
            personal information. Wishlist may also disclose information where reasonably necessary
            to comply with applicable law, respond to valid legal process, protect the security or
            integrity of the application, or prevent abuse.
          </p>
        </section>

        <section className="privacy-section">
          <h2>11. International Users</h2>
          <p>
            Wishlist is operated from the United States. If you access Wishlist from outside the
            United States, your information may be processed and stored in the United States or in
            other locations used by Wishlist&rsquo;s service providers.
          </p>
        </section>

        <section className="privacy-section">
          <h2>12. Your Privacy Choices</h2>
          <p>You have a number of choices in how you interact with Wishlist, including:</p>
          <ul>
            <li>Choosing not to create an account.</li>
            <li>Choosing not to upload a profile photo or a Look Studio reference image.</li>
            <li>Choosing not to use the Visualize feature &mdash; the rest of Wishlist&rsquo;s functionality does not require it.</li>
            <li>Removing saved items, Collections, and Outfits from within the application.</li>
          </ul>
        </section>

        <section className="privacy-section">
          <h2>13. Changes to This Privacy Policy</h2>
          <p>
            This Privacy Policy may be updated as the Wishlist project evolves. The &ldquo;Last
            Updated&rdquo; date at the top of this page will be changed whenever this policy is
            revised. Continued use of Wishlist after a revision constitutes acknowledgment of the
            updated policy.
          </p>
        </section>
      </div>
    </div>
  );
}

export default PrivacyPolicyView;
