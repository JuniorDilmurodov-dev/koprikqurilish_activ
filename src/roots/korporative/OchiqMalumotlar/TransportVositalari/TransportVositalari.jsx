import Header from "../../../../containers/header/Header";
import Footer from "../../../../containers/footer/Footer";
import Breadcrumb from "../../../../components/breadcrumb/Breadcrumb";
import { BackGroundColor } from "../../../../const/Wrapper";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const TransportVositalari = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <div className="flex flex-col min-h-screen bg-gray-50 font-sans">
      <Header />

      <BackGroundColor>
        <div className="container max-w-[1200px] mx-auto px-4 sm:px-6">
          <Breadcrumb
            links={[
              { link: t("menus.menu7.title3") },
              { link: t("transportVositalari") },
            ]}
          />

          <h1 className="text-3xl font-bold text-yellow-600 mb-8 text-center sm:text-left uppercase">
            {t("transportVositalari")}
          </h1>

          <div className="bg-white shadow-lg rounded-2xl p-6 sm:p-8 border border-gray-200">
            <div className="flex items-center justify-between gap-4 mb-6">
              <p className="text-lg text-gray-700">
                {t("transportVositalari_desc")}
              </p>
              <button
                onClick={() => navigate(-1)}
                className="bg-yellow-500 hover:bg-yellow-600 text-white font-medium px-5 py-2 rounded-lg shadow-md transition"
              >
                {t("transportVositalari_back")}
              </button>
            </div>

            <a
              href="/jamiyat_transport.xls"
              download="jamiyat_transport.xls"
              className="inline-block bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-3 rounded-lg shadow-md transition font-semibold"
            >
              📄 {t("transportVositalari_download")}
            </a>
          </div>
        </div>
      </BackGroundColor>

      <div className="mt-12"></div>
      <Footer
        showPartners={false}
        showProjects={false}
        showUsefulLinks={false}
      />
    </div>
  );
};

export default TransportVositalari;
