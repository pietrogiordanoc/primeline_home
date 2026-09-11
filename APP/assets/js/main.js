// Prime Line — shared interactions (header solid state, reveal-on-scroll, nav toggle)
document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('.site-header');
  if (header) {
    const onScroll = () => header.classList.toggle('is-solid', window.scrollY > 60);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  const revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealEls.forEach((el) => io.observe(el));
  }

  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('is-open'));
  }

  const simpleHeader = document.querySelector('.site-header-simple');
  if (simpleHeader) {
    const onScrollSimple = () => simpleHeader.classList.toggle('is-scrolled', window.scrollY > 10);
    onScrollSimple();
    window.addEventListener('scroll', onScrollSimple, { passive: true });
  }

  const menuToggle = document.querySelector('.menu-toggle');
  const navPanel = document.querySelector('.nav-panel');
  const navOverlay = document.querySelector('.nav-overlay');
  const navPanelClose = document.querySelector('.nav-panel-close');
  const contactPanel = document.querySelector('.contact-panel');
  const contactPanelClose = document.querySelector('.contact-panel-close');
  const contactTriggers = document.querySelectorAll('.contact-trigger');
  const locationsPanel = document.querySelector('.locations-panel');
  const aboutPanel = document.querySelector('.about-panel');
  const aboutPanelClose = document.querySelector('.about-panel-close');
  const aboutTriggers = document.querySelectorAll('.about-trigger');
  const catalogPanel = document.querySelector('.catalog-panel');
  const catalogPanelClose = document.querySelector('.catalog-panel-close');
  const catalogTriggers = document.querySelectorAll('.catalog-trigger');
  const masterlinkPanel = document.querySelector('.masterlink-panel');
  const masterlinkPanelClose = document.querySelector('.masterlink-panel-close');
  const masterlinkTriggers = document.querySelectorAll('.masterlink-trigger');
  const catalogPdfPanel = document.querySelector('.catalog-pdf-panel');
  const catalogPdfPanelClose = catalogPdfPanel?.querySelector('.masterlink-panel-close');
  const catalogPdfTriggers = document.querySelectorAll('.catalog-pdf-trigger');
  const orderEntryPanel = document.querySelector('.order-entry-panel');
  const orderEntryPanelClose = orderEntryPanel?.querySelector('.order-entry-panel-close');
  const orderEntryTriggers = document.querySelectorAll('.order-entry-trigger');
  const accountFormsPanel = document.querySelector('.account-forms-panel');
  const accountFormsPanelClose = accountFormsPanel?.querySelector('.account-forms-panel-close');
  const accountFormsTriggers = document.querySelectorAll('.account-forms-trigger');
  const curtainTransitionMs = 500;

  const contactInfo = document.querySelector('.contact-info');

  // Collapses locations, then contact, one step at a time — never all at once.
  const closeContact = (onClosed) => {
    locationsPanel?.classList.remove('is-open');
    locationsPanel?.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
      contactPanel?.classList.remove('is-open');
      contactPanel?.setAttribute('aria-hidden', 'true');
      contactInfo?.classList.remove('is-open');
      if (onClosed) setTimeout(onClosed, curtainTransitionMs);
    }, 200);
  };

  const closeAbout = (onClosed) => {
    aboutPanel?.classList.remove('is-open');
    aboutPanel?.setAttribute('aria-hidden', 'true');
    if (onClosed) setTimeout(onClosed, curtainTransitionMs);
  };

  const closeCatalog = (onClosed) => {
    catalogPanel?.classList.remove('is-open');
    catalogPanel?.setAttribute('aria-hidden', 'true');
    if (onClosed) setTimeout(onClosed, curtainTransitionMs);
  };

  const closeMasterlink = (onClosed) => {
    masterlinkPanel?.classList.remove('is-open');
    masterlinkPanel?.setAttribute('aria-hidden', 'true');
    if (onClosed) setTimeout(onClosed, curtainTransitionMs);
  };

  const closeCatalogPdf = (onClosed) => {
    catalogPdfPanel?.classList.remove('is-open');
    catalogPdfPanel?.setAttribute('aria-hidden', 'true');
    if (onClosed) setTimeout(onClosed, curtainTransitionMs);
  };

  const closeOrderEntry = (onClosed) => {
    orderEntryPanel?.classList.remove('is-open');
    orderEntryPanel?.setAttribute('aria-hidden', 'true');
    if (onClosed) setTimeout(onClosed, curtainTransitionMs);
  };

  const closeAccountForms = (onClosed) => {
    accountFormsPanel?.classList.remove('is-open');
    accountFormsPanel?.setAttribute('aria-hidden', 'true');
    if (onClosed) setTimeout(onClosed, curtainTransitionMs);
  };

  if (menuToggle && navPanel && navOverlay) {
    const openMenu = () => {
      navPanel.classList.add('is-open');
      navOverlay.classList.add('is-open');
      navPanel.setAttribute('aria-hidden', 'false');
      menuToggle.setAttribute('aria-expanded', 'true');
    };
    // Staggered close: any inner curtain first, then the menu itself.
    const closeMenu = () => {
      const hadContactOpen = contactPanel?.classList.contains('is-open');
      const hadAboutOpen = aboutPanel?.classList.contains('is-open');
      const hadCatalogOpen = catalogPanel?.classList.contains('is-open');
      const hadMasterlinkOpen = masterlinkPanel?.classList.contains('is-open');
      const hadCatalogPdfOpen = catalogPdfPanel?.classList.contains('is-open');
      const hadOrderEntryOpen = orderEntryPanel?.classList.contains('is-open');
      const hadAccountFormsOpen = accountFormsPanel?.classList.contains('is-open');
      closeContact();
      closeAbout();
      closeCatalog();
      closeMasterlink();
      closeCatalogPdf();
      closeOrderEntry();
      closeAccountForms();
      setTimeout(() => {
        navPanel.classList.remove('is-open');
        navOverlay.classList.remove('is-open');
        navPanel.setAttribute('aria-hidden', 'true');
        menuToggle.setAttribute('aria-expanded', 'false');
      }, (hadContactOpen || hadAboutOpen || hadCatalogOpen || hadMasterlinkOpen || hadCatalogPdfOpen || hadOrderEntryOpen || hadAccountFormsOpen) ? 420 : 0);
    };
    menuToggle.addEventListener('click', openMenu);
    navOverlay.addEventListener('click', closeMenu);
    navPanelClose?.addEventListener('click', closeMenu);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu();
    });
  }

  // Contact opens as a second curtain alongside the menu, with locations as a third. Clicking another curtain closes this one first.
  if (contactPanel && contactTriggers.length) {
    const openContact = (e) => {
      e.preventDefault();
      if (contactPanel.classList.contains('is-open')) {
        closeContact();
        return;
      }
      const showContact = () => {
        navPanel?.classList.add('is-open');
        navOverlay?.classList.add('is-open');
        navPanel?.setAttribute('aria-hidden', 'false');
        contactPanel.classList.add('is-open');
        contactPanel.setAttribute('aria-hidden', 'false');
        contactInfo?.classList.add('is-open');
        locationsPanel?.classList.add('is-open');
        locationsPanel?.setAttribute('aria-hidden', 'false');
      };
      if (aboutPanel?.classList.contains('is-open')) {
        closeAbout(showContact);
      } else if (catalogPanel?.classList.contains('is-open')) {
        closeCatalog(showContact);
      } else if (masterlinkPanel?.classList.contains('is-open')) {
        closeMasterlink(showContact);
      } else if (catalogPdfPanel?.classList.contains('is-open')) {
        closeCatalogPdf(showContact);
      } else if (orderEntryPanel?.classList.contains('is-open')) {
        closeOrderEntry(showContact);
      } else if (accountFormsPanel?.classList.contains('is-open')) {
        closeAccountForms(showContact);
      } else {
        showContact();
      }
    };
    contactTriggers.forEach((trigger) => trigger.addEventListener('click', openContact));
    contactPanelClose?.addEventListener('click', closeContact);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeContact();
    });
    contactPanel.querySelector('.contact-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      closeContact();
    });
  }

  // About Us opens as its own curtain alongside the menu. Clicking another curtain closes this one first.
  if (aboutPanel && aboutTriggers.length) {
    const openAbout = (e) => {
      e.preventDefault();
      if (aboutPanel.classList.contains('is-open')) {
        closeAbout();
        return;
      }
      const showAbout = () => {
        navPanel?.classList.add('is-open');
        navOverlay?.classList.add('is-open');
        navPanel?.setAttribute('aria-hidden', 'false');
        aboutPanel.classList.add('is-open');
        aboutPanel.setAttribute('aria-hidden', 'false');
      };
      if (contactPanel?.classList.contains('is-open')) {
        closeContact(showAbout);
      } else if (catalogPanel?.classList.contains('is-open')) {
        closeCatalog(showAbout);
      } else if (masterlinkPanel?.classList.contains('is-open')) {
        closeMasterlink(showAbout);
      } else if (catalogPdfPanel?.classList.contains('is-open')) {
        closeCatalogPdf(showAbout);
      } else if (orderEntryPanel?.classList.contains('is-open')) {
        closeOrderEntry(showAbout);
      } else if (accountFormsPanel?.classList.contains('is-open')) {
        closeAccountForms(showAbout);
      } else {
        showAbout();
      }
    };
    aboutTriggers.forEach((trigger) => trigger.addEventListener('click', openAbout));
    aboutPanelClose?.addEventListener('click', closeAbout);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAbout();
    });
  }

  // Login and Register share one catalog preview curtain, then continue to the selected destination.
  if (catalogPanel && catalogTriggers.length) {
    const openCatalog = (e) => {
      e.preventDefault();
      const destination = e.currentTarget.dataset.catalogUrl;
      const showCatalog = () => {
        navPanel?.classList.add('is-open');
        navOverlay?.classList.add('is-open');
        navPanel?.setAttribute('aria-hidden', 'false');
        catalogPanel.classList.add('is-open');
        catalogPanel.setAttribute('aria-hidden', 'false');
        catalogPanel.querySelector('.catalog-login')?.setAttribute('data-destination', destination || '');
        catalogPanel.querySelector('.catalog-register')?.setAttribute('data-destination', destination || '');
      };
      const switchToCatalog = () => {
        if (contactPanel?.classList.contains('is-open')) {
          closeContact(() => {
            if (aboutPanel?.classList.contains('is-open')) closeAbout(showCatalog);
            else showCatalog();
          });
        } else if (aboutPanel?.classList.contains('is-open')) {
          closeAbout(showCatalog);
        } else if (masterlinkPanel?.classList.contains('is-open')) {
          closeMasterlink(showCatalog);
        } else if (catalogPdfPanel?.classList.contains('is-open')) {
          closeCatalogPdf(showCatalog);
        } else if (orderEntryPanel?.classList.contains('is-open')) {
          closeOrderEntry(showCatalog);
        } else if (accountFormsPanel?.classList.contains('is-open')) {
          closeAccountForms(showCatalog);
        } else {
          showCatalog();
        }
      };
      if (catalogPanel.classList.contains('is-open')) {
        catalogPanel.querySelector('.catalog-login')?.setAttribute('data-destination', destination || '');
        catalogPanel.querySelector('.catalog-register')?.setAttribute('data-destination', destination || '');
      } else {
        switchToCatalog();
      }
    };
    catalogTriggers.forEach((trigger) => trigger.addEventListener('click', openCatalog));
    catalogPanelClose?.addEventListener('click', closeCatalog);

    const catalogRegister = catalogPanel.querySelector('.catalog-register');
    const catalogNotice = catalogPanel.querySelector('.catalog-notice');
    const showCatalogNotice = () => catalogNotice?.classList.add('is-visible');
    const hideCatalogNotice = () => catalogNotice?.classList.remove('is-visible');
    catalogRegister?.addEventListener('mouseenter', showCatalogNotice);
    catalogRegister?.addEventListener('mouseleave', hideCatalogNotice);
    catalogRegister?.addEventListener('focus', showCatalogNotice);
    catalogRegister?.addEventListener('blur', hideCatalogNotice);
  }

  const setupEmailCodeAccess = (panel, resourceName) => {
    const emailForm = panel.querySelector('.access-email-form');
    const codeForm = panel.querySelector('.access-code-form');
    const emailInput = emailForm?.querySelector('[name="access-email"]');
    const codeInput = codeForm?.querySelector('[name="access-code"]');
    const status = panel.querySelector('.masterlink-status');
    const backButton = panel.querySelector('.masterlink-back');
    const lead = panel.querySelector('.masterlink-lead');
    let email = '';

    const showStatus = (message, isError = false) => {
      if (!status) return;
      status.textContent = message;
      status.classList.toggle('is-error', isError);
    };

    emailForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      email = emailInput?.value.trim().toLowerCase() || '';
      if (!email.endsWith('@primelinedist.com')) {
        showStatus('Please use your company email address.', true);
        return;
      }

      const button = emailForm.querySelector('button');
      if (button) button.disabled = true;
      showStatus('Sending your access code...');
      try {
        const response = await fetch('/api/access/request-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, resource: resourceName })
        });
        if (!response.ok) throw new Error('request-failed');
        emailForm.hidden = true;
        codeForm.hidden = false;
        backButton.hidden = false;
        if (lead) lead.textContent = `Enter the 3-digit code sent to ${email}.`;
        showStatus('The code expires in 10 minutes.');
        codeInput?.focus();
      } catch {
        showStatus('We could not send the code. Please try again.', true);
      } finally {
        if (button) button.disabled = false;
      }
    });

    codeForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = codeInput?.value.trim() || '';
      if (!/^\d{3}$/.test(code)) {
        showStatus('Enter the 3-digit code from your email.', true);
        return;
      }

      const button = codeForm.querySelector('button');
      if (button) button.disabled = true;
      showStatus('Checking your code...');
      try {
        const response = await fetch('/api/access/verify-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, code, resource: resourceName })
        });
        if (!response.ok) {
          showStatus('That code is incorrect or has expired.', true);
          codeInput?.select();
          return;
        }
        codeInput.value = '';
        showStatus('Access granted.');
      } catch {
        showStatus('We could not verify the code. Please try again.', true);
      } finally {
        if (button) button.disabled = false;
      }
    });

    codeInput?.addEventListener('input', () => {
      codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 3);
    });

    backButton?.addEventListener('click', () => {
      email = '';
      emailForm.hidden = false;
      codeForm.hidden = true;
      backButton.hidden = true;
      codeInput.value = '';
      if (lead) lead.textContent = 'Enter your company email to receive a 3-digit access code.';
      showStatus('');
      emailInput?.focus();
    });
  };

  if (masterlinkPanel && masterlinkTriggers.length) {
    const openMasterlink = (e) => {
      e.preventDefault();
      const showMasterlink = () => {
        navPanel?.classList.add('is-open');
        navOverlay?.classList.add('is-open');
        navPanel?.setAttribute('aria-hidden', 'false');
        masterlinkPanel.classList.add('is-open');
        masterlinkPanel.setAttribute('aria-hidden', 'false');
      };
      if (masterlinkPanel.classList.contains('is-open')) {
        closeMasterlink();
      } else if (contactPanel?.classList.contains('is-open')) {
        closeContact(() => {
          if (aboutPanel?.classList.contains('is-open')) closeAbout(showMasterlink);
          else showMasterlink();
        });
      } else if (aboutPanel?.classList.contains('is-open')) {
        closeAbout(showMasterlink);
      } else if (catalogPanel?.classList.contains('is-open')) {
        closeCatalog(showMasterlink);
      } else if (catalogPdfPanel?.classList.contains('is-open')) {
        closeCatalogPdf(showMasterlink);
      } else if (orderEntryPanel?.classList.contains('is-open')) {
        closeOrderEntry(showMasterlink);
      } else if (accountFormsPanel?.classList.contains('is-open')) {
        closeAccountForms(showMasterlink);
      } else {
        showMasterlink();
      }
    };
    masterlinkTriggers.forEach((trigger) => trigger.addEventListener('click', openMasterlink));
    masterlinkPanelClose?.addEventListener('click', closeMasterlink);

    setupEmailCodeAccess(masterlinkPanel, 'masterlink');
  }

  if (catalogPdfPanel && catalogPdfTriggers.length) {
    const openCatalogPdf = (e) => {
      e.preventDefault();
      const showCatalogPdf = () => {
        navPanel?.classList.add('is-open');
        navOverlay?.classList.add('is-open');
        navPanel?.setAttribute('aria-hidden', 'false');
        catalogPdfPanel.classList.add('is-open');
        catalogPdfPanel.setAttribute('aria-hidden', 'false');
      };
      if (catalogPdfPanel.classList.contains('is-open')) {
        closeCatalogPdf();
      } else if (contactPanel?.classList.contains('is-open')) {
        closeContact(showCatalogPdf);
      } else if (aboutPanel?.classList.contains('is-open')) {
        closeAbout(showCatalogPdf);
      } else if (catalogPanel?.classList.contains('is-open')) {
        closeCatalog(showCatalogPdf);
      } else if (masterlinkPanel?.classList.contains('is-open')) {
        closeMasterlink(showCatalogPdf);
      } else if (orderEntryPanel?.classList.contains('is-open')) {
        closeOrderEntry(showCatalogPdf);
      } else if (accountFormsPanel?.classList.contains('is-open')) {
        closeAccountForms(showCatalogPdf);
      } else {
        showCatalogPdf();
      }
    };
    catalogPdfTriggers.forEach((trigger) => trigger.addEventListener('click', openCatalogPdf));
    catalogPdfPanelClose?.addEventListener('click', closeCatalogPdf);

    setupEmailCodeAccess(catalogPdfPanel, 'catalog-pdf');
  }

  if (orderEntryPanel && orderEntryTriggers.length) {
    const openOrderEntry = (e) => {
      e.preventDefault();
      const showOrderEntry = () => {
        navPanel?.classList.add('is-open');
        navOverlay?.classList.add('is-open');
        navPanel?.setAttribute('aria-hidden', 'false');
        orderEntryPanel.classList.add('is-open');
        orderEntryPanel.setAttribute('aria-hidden', 'false');
      };
      if (orderEntryPanel.classList.contains('is-open')) {
        closeOrderEntry();
      } else if (contactPanel?.classList.contains('is-open')) {
        closeContact(showOrderEntry);
      } else if (aboutPanel?.classList.contains('is-open')) {
        closeAbout(showOrderEntry);
      } else if (catalogPanel?.classList.contains('is-open')) {
        closeCatalog(showOrderEntry);
      } else if (masterlinkPanel?.classList.contains('is-open')) {
        closeMasterlink(showOrderEntry);
      } else if (catalogPdfPanel?.classList.contains('is-open')) {
        closeCatalogPdf(showOrderEntry);
      } else if (accountFormsPanel?.classList.contains('is-open')) {
        closeAccountForms(showOrderEntry);
      } else {
        showOrderEntry();
      }
    };
    orderEntryTriggers.forEach((trigger) => trigger.addEventListener('click', openOrderEntry));
    orderEntryPanelClose?.addEventListener('click', closeOrderEntry);
  }

  if (accountFormsPanel && accountFormsTriggers.length) {
    const openAccountForms = (e) => {
      e.preventDefault();
      const showAccountForms = () => {
        navPanel?.classList.add('is-open');
        navOverlay?.classList.add('is-open');
        navPanel?.setAttribute('aria-hidden', 'false');
        accountFormsPanel.classList.add('is-open');
        accountFormsPanel.setAttribute('aria-hidden', 'false');
      };
      if (accountFormsPanel.classList.contains('is-open')) {
        closeAccountForms();
      } else if (contactPanel?.classList.contains('is-open')) {
        closeContact(showAccountForms);
      } else if (aboutPanel?.classList.contains('is-open')) {
        closeAbout(showAccountForms);
      } else if (catalogPanel?.classList.contains('is-open')) {
        closeCatalog(showAccountForms);
      } else if (masterlinkPanel?.classList.contains('is-open')) {
        closeMasterlink(showAccountForms);
      } else if (catalogPdfPanel?.classList.contains('is-open')) {
        closeCatalogPdf(showAccountForms);
      } else if (orderEntryPanel?.classList.contains('is-open')) {
        closeOrderEntry(showAccountForms);
      } else {
        showAccountForms();
      }
    };
    accountFormsTriggers.forEach((trigger) => trigger.addEventListener('click', openAccountForms));
    accountFormsPanelClose?.addEventListener('click', closeAccountForms);
  }

  // Add a copy-to-clipboard button next to every phone/email link in the locations panel.
  if (locationsPanel) {
    locationsPanel.querySelectorAll('a[href^="tel:"], a[href^="mailto:"]').forEach((link) => {
      const value = link.textContent.trim();
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'copy-btn';
      btn.setAttribute('aria-label', `Copy ${value}`);
      btn.innerHTML = '<svg viewBox="0 0 20 20"><rect x="7" y="7" width="10" height="10" rx="1.5"/><rect x="3" y="3" width="10" height="10" rx="1.5"/></svg>';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        navigator.clipboard?.writeText(value).then(() => {
          btn.classList.add('is-copied');
          setTimeout(() => btn.classList.remove('is-copied'), 1400);
        });
      });
      link.insertAdjacentElement('afterend', btn);
    });
  }

  const slider = document.querySelector('.banner-slider');
  if (slider) {
    const track = slider.querySelector('.slider-track');
    const dotsWrap = slider.querySelector('.slider-dots');
    const prevBtn = slider.querySelector('.slider-arrow--prev');
    const nextBtn = slider.querySelector('.slider-arrow--next');
    const bannerDir = track.dataset.bannerDir;

    // Auto-discover images from the folder's directory listing (dev server only); falls back to the static markup on failure.
    const autoLoadSlides = async () => {
      if (!bannerDir) return;
      try {
        const res = await fetch(bannerDir);
        if (!res.ok) return;
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const files = Array.from(doc.querySelectorAll('a'))
          .map((a) => a.getAttribute('href') || '')
          .filter((href) => /\.(jpe?g|png|webp|gif)$/i.test(href))
          .sort((a, b) => a.localeCompare(b));
        if (!files.length) return;

        track.textContent = '';
        files.forEach((href, i) => {
          const name = decodeURIComponent(href.split('/').pop());
          const alt = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
          const slide = document.createElement('div');
          slide.className = 'slide' + (i === 0 ? ' is-active' : '');
          const img = document.createElement('img');
          img.src = bannerDir + href;
          img.alt = alt;
          slide.appendChild(img);
          track.appendChild(slide);
        });
      } catch {
        // keep the static fallback slides already in the HTML
      }
    };

    // Placeholder copy keyed by image filename (without extension) — replace with final copy per category.
    const bannerCopy = {
      antipasto_and_vegetables: { eyebrow: 'Antipasto', title: 'Antipasto & Vegetables', text: 'Reference text about antipasto and vegetables. Replace with final copy.' },
      baking_and_pastry: { eyebrow: 'Bakery', title: 'Baking & Pastry', text: 'Reference text about baking and pastry. Replace with final copy.' },
      balsamic1: { eyebrow: 'Vinegars', title: 'Balsamic Vinegar', text: 'Reference text about balsamic vinegar. Replace with final copy.' },
      beans_and_legumes: { eyebrow: 'Legumes', title: 'Beans & Legumes', text: 'Reference text about beans and legumes. Replace with final copy.' },
      coffee_and_tea: { eyebrow: 'Coffee & Tea', title: 'Coffee & Tea', text: 'Reference text about coffee and tea. Replace with final copy.' },
      condiments_sauces_and_stocks: { eyebrow: 'Condiments', title: 'Condiments, Sauces & Stocks', text: 'Reference text about condiments. Replace with final copy.' },
      confections_and_baked_goods: { eyebrow: 'Confections', title: 'Confections & Baked Goods', text: 'Reference text about confections. Replace with final copy.' },
      cured_meats: { eyebrow: 'Charcuterie', title: 'Cured Meats', text: 'Reference text about cured meats. Replace with final copy.' },
      desserts_and_gelato: { eyebrow: 'Desserts', title: 'Desserts & Gelato', text: 'Reference text about desserts. Replace with final copy.' },
      fish_and_seafood: { eyebrow: 'Seafood', title: 'Fish & Seafood', text: 'Reference text about fish and seafood. Replace with final copy.' },
      flour_rice_and_grains: { eyebrow: 'Grains', title: 'Flour, Rice & Grains', text: 'Reference text about grains. Replace with final copy.' },
      'olivesand oil': { eyebrow: 'Oils', title: 'Olives & Oil', text: 'Reference text about olives and oil. Replace with final copy.' },
      pasta: { eyebrow: 'Pasta', title: 'Italian Pasta', text: 'We sell the finest pasta from Italy. Replace with final copy.' },
    };

    // Full rich landing (intro/trio/spot/tips/diff/close) for categories with final copy — others fall back to a simple caption.
    const categoryDetailTemplates = {
      antipasto_and_vegetables: () => `
        <section class="cv-title reveal">
          <h2>Preserved Vegetables</h2>
          <span class="cv-title-sub">Antipastos &amp; Vegetables</span>
        </section>
        <section class="cv-intro">
          <div class="cv-intro-photo reveal"><img src="images/spots/agnoni1.png" alt="Balsamic-glazed onions and grilled mushrooms, rustic Italian kitchen"></div>
          <div class="cv-intro-copy reveal">
            <span class="eyebrow">Curated for Professional Kitchens</span>
            <h2>Exceptional Ingredients. Endless Possibilities.</h2>
            <p>Prime Line Distributors sources a distinctive selection of preserved vegetables and Mediterranean specialties chosen for their flavor, consistency, and presentation.</p>
            <p>From everyday essentials to harder-to-find delicacies, our portfolio helps chefs create memorable dishes without compromising quality.</p>
          </div>
        </section>
        <section class="cv-trio">
          <a class="cv-trio-card reveal" href="#">
            <img src="images/spots/Primizia Artichokes VE59.png" alt="Artichoke hearts, whole and halved" style="object-position: left center;">
            <div class="cv-trio-label"><h3>Artichokes</h3><p>Tender, flavorful and remarkably versatile—from antipasti and salads to pizzas, pastas and signature entrées.</p></div>
          </a>
          <a class="cv-trio-card reveal" href="#">
            <img src="images/spots/deliziedicalabria02.jpg" alt="Hand-harvesting fresh Calabrian chili peppers into a crate">
            <div class="cv-trio-label"><h3>Peppers</h3><p>Fiery Calabrian chilies, sun-ripened and hand-harvested for bold, authentic heat.</p></div>
          </a>
          <a class="cv-trio-card reveal" href="#">
            <img src="images/spots/cappers.jpg" alt="Capers in a rustic wooden bowl">
            <div class="cv-trio-label"><h3>Capers</h3><p>Hand-harvested on Pantelleria, off the southern coast of Italy — prized for their delicate texture and briny, aromatic flavor.</p></div>
          </a>
        </section>
        <section class="cv-spot">
          <div class="cv-spot-copy reveal">
            <span class="eyebrow">A Closer Look</span>
            <h2>The Art of Antipasto</h2>
            <p>Roasted and grilled over open flame, then rested in oil to develop deep, smoky sweetness — this is antipasto the way Sicilian kitchens have always made it.</p>
            <p>Our selection includes artichokes, eggplants, mixed mushrooms, peppers, tomatoes and zucchini, each prepared to be ready for the table in minutes.</p>
            <a href="#">Discover Our Antipasto Selection</a>
          </div>
          <div class="cv-spot-photo reveal"><img src="images/spots/buscema1.png" alt="Assorted grilled and roasted vegetable antipasti in oil"></div>
        </section>
        <section class="cv-tips reveal">
          <span class="eyebrow">From Our Table</span>
          <h2>Simple Ways to Elevate the Menu</h2>
          <p>Our assortment spans the full range of Mediterranean preserved vegetables — tender artichokes and hearts, sweet and hot peppers roasted or stuffed, giardiniera and cornichons, capers in salt or oil, sun-dried and semi-dried tomatoes, marinated grape leaves and specialty accompaniments like hearts of palm and preserved lemons. Every item is chosen for consistent quality, practical formats and the authentic flavor chefs expect from true Mediterranean sourcing.</p>
        </section>
        <section class="cv-icons">
          <div class="cv-icons-row">
            <div class="cv-icon-item reveal"><img src="images/icons/artich.png" alt="Artichokes"></div>
            <div class="cv-icon-item reveal"><img src="images/icons/peppers.png" alt="Peppers"></div>
            <div class="cv-icon-item reveal"><img src="images/icons/miscveg.png" alt="Giardiniera"></div>
            <div class="cv-icon-item reveal"><img src="images/icons/cornich.png" alt="Cornichons"></div>
            <div class="cv-icon-item reveal"><img src="images/icons/capers.png" alt="Capers"></div>
            <div class="cv-icon-item reveal"><img src="images/icons/drytom.png" alt="Sun-dried tomatoes"></div>
            <div class="cv-icon-item reveal"><img src="images/icons/grapeleave.png" alt="Grape leaves"></div>
            <div class="cv-icon-item reveal"><img src="images/icons/heartpalm.png" alt="Hearts of palm"></div>
            <div class="cv-icon-item reveal"><img src="images/icons/lemon.png" alt="Preserved lemons"></div>
          </div>
        </section>
        <section class="cv-diff">
          <span class="eyebrow">A Collection Built for Food Professionals</span>
          <div class="cv-diff-grid">
            <div class="cv-diff-item reveal"><h4>Carefully Selected</h4><p>Products chosen for authentic flavor, texture and visual appeal.</p></div>
            <div class="cv-diff-item reveal"><h4>Kitchen Ready</h4><p>Practical formats created for consistency and efficiency.</p></div>
            <div class="cv-diff-item reveal"><h4>Broad Assortment</h4><p>Classic Mediterranean staples and specialty ingredients from trusted producers.</p></div>
          </div>
        </section>
        <section class="cv-close">
          <img src="images/spots/deliziedicalabria01.jpg" alt="Calabrian chili peppers, freshly harvested on a hillside overlooking the coast">
          <div class="cv-close-content reveal">
            <span class="eyebrow cv-eyebrow--light">Grown in Calabria, Italy</span>
            <h1>Sun-Ripened, Hand-Harvested, Truly Authentic</h1>
            <p>From sun-drenched hillsides overlooking the Ionian coast, our Calabrian chili peppers are hand-harvested at their peak and prepared using time-honored methods — bringing fiery, authentic flavor to every dish.</p>
            <div class="cv-close-actions">
              <a href="#" class="btn btn--light" style="color:#fff;border-color:#fff;">View Products</a>
              <a href="#contact" class="btn btn--light" style="color:#fff;border-color:#fff;">Request Information</a>
            </div>
          </div>
        </section>`,
    };

    function defaultDetailTemplate(data) {
      return `
        <section class="banner-caption">
          <div class="banner-caption-inner">
            <button type="button" class="detail-slider-arrow detail-slider-arrow--prev" aria-label="Previous slide">&#10094;</button>
            <span class="eyebrow banner-caption-eyebrow">${data.eyebrow}</span>
            <h2 class="banner-caption-title">${data.title}</h2>
            <p class="banner-caption-text">${data.text}</p>
            <button type="button" class="detail-slider-arrow detail-slider-arrow--next" aria-label="Next slide">&#10095;</button>
          </div>
        </section>`;
    }

    const categoryDetail = document.getElementById('categoryDetail');

    function updateCategoryDetail(slideEl) {
      if (!categoryDetail) return;
      const img = slideEl.querySelector('img');
      const key = decodeURIComponent((img?.getAttribute('src') || '').split('/').pop() || '').replace(/\.[^.]+$/, '');
      const data = bannerCopy[key] || { eyebrow: 'Prime Line', title: img?.alt || 'Category', text: 'Reference text coming soon.' };
      const render = categoryDetailTemplates[key] || (() => defaultDetailTemplate(data));
      categoryDetail.classList.add('is-fading');
      setTimeout(() => {
        categoryDetail.innerHTML = render();
        categoryDetail.classList.remove('is-fading');
        categoryDetail.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'));
      }, 300);
    }

    const initSlider = () => {
      const slides = Array.from(track.querySelectorAll('.slide'));
      if (!slides.length) return;
      let current = Math.max(0, slides.findIndex((s) => s.classList.contains('is-active')));
      let timer;
      let autoplayAllowed = true;

      dotsWrap.textContent = '';
      slides.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'dot' + (i === current ? ' is-active' : '');
        dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
        dot.addEventListener('click', () => goTo(i));
        dotsWrap.appendChild(dot);
      });
      const dots = Array.from(dotsWrap.children);
      updateCategoryDetail(slides[current]);

      function goTo(index) {
        slides[current].classList.remove('is-active');
        dots[current].classList.remove('is-active');
        current = (index + slides.length) % slides.length;
        slides[current].classList.add('is-active');
        dots[current].classList.add('is-active');
        updateCategoryDetail(slides[current]);
        resetTimer();
      }
      categoryDetail?.addEventListener('click', (e) => {
        const button = e.target.closest('.detail-slider-arrow');
        if (!button) return;
        goTo(button.classList.contains('detail-slider-arrow--prev') ? current - 1 : current + 1);
      });
      function resetTimer() {
        clearInterval(timer);
        if (!autoplayAllowed) return;
        timer = setInterval(() => goTo(current + 1), 5000);
      }

      slider.setAttribute('tabindex', '0');
      slider.setAttribute('aria-label', 'Featured categories slider');
      slider.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          goTo(current - 1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          goTo(current + 1);
        } else if (e.key === 'Home') {
          e.preventDefault();
          goTo(0);
        } else if (e.key === 'End') {
          e.preventDefault();
          goTo(slides.length - 1);
        }
      });
      slider.addEventListener('mouseenter', () => clearInterval(timer));
      slider.addEventListener('mouseleave', resetTimer);
      slider.addEventListener('focusin', () => clearInterval(timer));
      slider.addEventListener('focusout', (e) => {
        if (!slider.contains(e.relatedTarget)) resetTimer();
      });

      // Pause autoplay as soon as the banner starts leaving the viewport (user reading the category detail below); resume only once it's fully back on screen.
      const visibilityObserver = new IntersectionObserver(([entry]) => {
        autoplayAllowed = entry.intersectionRatio >= 0.99;
        if (autoplayAllowed) resetTimer();
        else clearInterval(timer);
      }, { threshold: [0, 0.99, 1] });
      visibilityObserver.observe(slider);

      prevBtn.addEventListener('click', () => goTo(current - 1));
      nextBtn.addEventListener('click', () => goTo(current + 1));
      resetTimer();
    };

    autoLoadSlides().finally(initSlider);
  }
});
